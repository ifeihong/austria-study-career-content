#!/usr/bin/env python3
"""Read a local Xiaohongshu export into private, immutable metric snapshots."""
import argparse
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
from datetime import datetime, timezone
from zipfile import ZipFile, BadZipFile
import xml.etree.ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
METADATA = ['笔记标题', '首次发布时间', '体裁']
METRICS = ['曝光', '观看量', '封面点击率', '点赞', '评论', '收藏', '涨粉', '分享', '人均观看时长', '弹幕']
MISSING = {'', '-', '--', 'n/a', 'na', 'null'}
MAX_FILE = 20 * 1024 * 1024
MAX_EXPANDED = 64 * 1024 * 1024
MAX_ROWS = 50000

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)

def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value).encode('utf-8')).hexdigest()

def read_xml(z, name):
    data = z.read(name)
    scan=data.replace(b'\x00',b'').upper()
    if b'<!DOCTYPE' in scan or b'<!ENTITY' in scan:
        raise ValueError('XML DOCTYPE/entities are not supported')
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f'Invalid XML: {name}') from exc

def header_rows(rows):
    result=[]
    for index, row in enumerate(rows):
        names=[str(name).strip() for name in row]
        if all(name in names for name in METADATA) and any(name in names for name in METRICS):
            named=[name for name in names if name]
            if len(named) != len(set(named)):
                raise ValueError('Duplicate column headers / 重复表头')
            result.append(index)
    return result

def read_xlsx(path):
    try:
        with ZipFile(path) as z:
            infos=z.infolist()
            if len(infos)>1024 or sum(x.file_size for x in infos)>MAX_EXPANDED:
                raise ValueError('XLSX archive exceeds size limits')
            names=[x.filename for x in infos]
            if len(names)!=len(set(names)):
                raise ValueError('Duplicate XLSX archive entries')
            for info in infos:
                p=PurePosixPath(info.filename)
                if p.is_absolute() or '..' in p.parts or '\\' in info.filename or ':' in info.filename:
                    raise ValueError('Unsafe XLSX archive path')
                if info.flag_bits & 1:
                    raise ValueError('Encrypted XLSX is not supported')
            workbook=read_xml(z,'xl/workbook.xml')
            rels=read_xml(z,'xl/_rels/workbook.xml.rels')
            relmap={r.get('Id'):r for r in rels}
            shared=[]
            if 'xl/sharedStrings.xml' in names:
                shared=[''.join(t.text or '' for t in si.iter('{'+NS['s']+'}t')) for si in read_xml(z,'xl/sharedStrings.xml')]
            candidates=[]
            for sheet in workbook.findall('s:sheets/s:sheet',NS):
                relation=relmap.get(sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'))
                if relation is None or relation.get('TargetMode')=='External':
                    raise ValueError('Missing or external worksheet relation')
                target=relation.get('Target','')
                if not relation.get('Type','').endswith('/worksheet'):
                    continue
                if '\\' in target or '..' in PurePosixPath(target).parts or ':' in target:
                    raise ValueError('Unsafe worksheet target')
                name=target.lstrip('/') if target.startswith('/') else 'xl/'+target
                tree=read_xml(z,name)
                rows=[]; formula_rows=set()
                for row in tree.findall('s:sheetData/s:row',NS):
                    try:coordinate=int(row.get('r',str(len(rows)+1)))
                    except ValueError as exc:raise ValueError('Invalid worksheet row reference') from exc
                    if coordinate<=len(rows) or coordinate>MAX_ROWS:
                        raise ValueError('Invalid or excessive worksheet row reference')
                    while len(rows)<coordinate-1:rows.append([])
                    if len(rows)>=MAX_ROWS:
                        raise ValueError('Too many worksheet rows')
                    cells={}
                    for cell in row.findall('s:c',NS):
                        reference=cell.get('r','')
                        match=re.fullmatch(r'([A-Z]+)([1-9][0-9]*)',reference)
                        if not match:
                            raise ValueError('Invalid cell reference')
                        if int(match.group(2))!=coordinate:raise ValueError('Cell row differs from worksheet row')
                        column=0
                        for letter in match.group(1):column=column*26+ord(letter)-64
                        if column>1024 or column in cells:
                            raise ValueError('Invalid or duplicate cell column')
                        if cell.find('s:f',NS) is not None:formula_rows.add(len(rows))
                        v=cell.find('s:v',NS); value=v.text if v is not None and v.text is not None else ''
                        kind=cell.get('t')
                        if kind=='s':
                            try:
                                index=int(value)
                                if index<0:raise ValueError('Negative shared string index')
                                value=shared[index]
                            except (IndexError,ValueError) as exc:raise ValueError('Invalid shared string index') from exc
                        elif kind=='inlineStr':value=''.join(t.text or '' for t in cell.findall('.//s:t',NS))
                        elif kind in ('e','b') and value:raise ValueError('Error/boolean cells are not metric values')
                        cells[column]=value
                    rows.append([cells.get(i,'') for i in range(1,max(cells,default=0)+1)])
                indices=header_rows(rows)
                if indices:
                    if len(indices)!=1:raise ValueError('Expected a unique data header / 唯一数据表头')
                    h=indices[0]
                    if any(i>=h for i in formula_rows):raise ValueError('Formula cells are not accepted / 不接受公式单元格')
                    candidates.append((sheet.get('name'),rows,h))
            if len(candidates)!=1:
                raise ValueError('Expected a unique sheet with metric headers / 需要唯一匹配数据工作表')
            return candidates[0]
    except (BadZipFile,KeyError) as exc:
        raise ValueError('Invalid or incomplete XLSX archive') from exc

def read_table(path):
    if path.stat().st_size>MAX_FILE:
        raise ValueError('Input file exceeds 20 MiB limit')
    if path.suffix.lower()=='.xlsx':return read_xlsx(path)
    if path.suffix.lower()!='.csv':raise ValueError('Only .xlsx and UTF-8 .csv are supported')
    try:
        with path.open(encoding='utf-8-sig',newline='') as f:
            rows=list(csv.reader(f))
    except UnicodeDecodeError as exc:raise ValueError('CSV must be UTF-8') from exc
    if len(rows)>MAX_ROWS:raise ValueError('Too many CSV rows')
    headers=header_rows(rows)
    if len(headers)!=1:raise ValueError('Expected a unique CSV data header')
    return None,rows,headers[0]

def numeric(value, field):
    raw=str(value).strip()
    if raw.lower() in MISSING:return None
    if raw.startswith(('=','+','@')):raise ValueError(f'Formula-like value in {field}')
    percent=raw.endswith('%')
    if percent and field!='封面点击率':raise ValueError(f'Unexpected percentage in {field}')
    try:result=float(raw[:-1] if percent else raw)
    except ValueError as exc:raise ValueError(f'Invalid number in {field}: {raw}') from exc
    if percent:result/=100
    if not math.isfinite(result) or result<0:raise ValueError(f'Invalid nonnegative value in {field}')
    if field=='封面点击率':
        if result>1:raise ValueError('CTR must be a 0..1 fraction or explicit percentage')
    elif field!='人均观看时长':
        if not result.is_integer():raise ValueError(f'Count must be an integer: {field}')
        return int(result)
    return result

def capture_time(value):
    if value is None:return None
    try:parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    except (ValueError,AttributeError) as exc:raise ValueError('captured-at must be an ISO timestamp') from exc
    if parsed.utcoffset() is None:raise ValueError('captured-at requires timezone / 统计时间必须有时区')
    return parsed.astimezone(timezone.utc).isoformat().replace('+00:00','Z')

def confirmed_map(path):
    if path is None:return {}
    if Path(path).stat().st_size>MAX_FILE:raise ValueError('Note map exceeds size limit')
    try:rows=json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (ValueError,UnicodeDecodeError) as exc:raise ValueError('Invalid note map JSON') from exc
    if not isinstance(rows,list):raise ValueError('Note map must be a JSON array')
    result={}
    for row in rows:
        if not isinstance(row,dict) or set(row)-{'title','publishedAt','noteId','workId','producer'}:
            raise ValueError('Invalid note map fields')
        for key in ('title','publishedAt','noteId'):
            if not isinstance(row.get(key),str) or not row[key].strip():raise ValueError(f'Note map needs {key}')
        if 'workId' in row and (not isinstance(row['workId'],str) or not row['workId'].strip()):raise ValueError('Invalid workId')
        if row.get('producer','unknown') not in ('unknown','Codex','WorkBuddy','other'):raise ValueError('Invalid mapped producer')
        identity=(row['title'],row['publishedAt'])
        if identity in result:raise ValueError('Duplicate note map key')
        result[identity]=row
    return result

def summarize(notes):
    sums={};known={};missing={}
    for k in METRICS:
        if k in ('封面点击率','人均观看时长'):continue
        values=[n['metrics'][k] for n in notes]
        missing[k]=sum(v is None for v in values)
        known[k]=sum(v for v in values if v is not None)
        sums[k]=None if missing[k] else known[k]
    ratios={}
    for k in ('收藏','评论','涨粉'):
        den=sums['观看量'];num=sums[k]
        ratios[k+'/观看量']=num/den if den not in (None,0) and num is not None else None
    return {'count':len(notes),'totals':sums,'knownTotals':known,'missingCounts':missing,'countRatios':ratios,'ratioMeaning':'次数比，非独立用户转化率；观看量/曝光不是本工具的CTR'}

def build_snapshot(input_path, captured_at=None, paid='unknown', producer='unknown', note_map=None):
    path=Path(input_path)
    if not path.is_file():raise ValueError('Input file does not exist')
    if paid not in ('unknown','yes','no') or producer not in ('unknown','Codex','WorkBuddy','other'):
        raise ValueError('Invalid paid/producer value')
    captured=capture_time(captured_at);mapping=confirmed_map(note_map)
    sheet,rows,h=read_table(path);headers=[str(key).strip() for key in rows[h]]
    notes=[];identities=set();note_ids=set()
    for row_number,row in enumerate(rows[h+1:],h+2):
        if not any(str(x).strip() for x in row):continue
        if len(row)>len(headers) and any(row[len(headers):]):raise ValueError(f'Unexpected extra cells at row {row_number}')
        if any(not key and i<len(row) and str(row[i]).strip() for i,key in enumerate(headers)):
            raise ValueError(f'Unnamed data column / 无表头的数据列 at row {row_number}')
        d={key:row[i] if i<len(row) else '' for i,key in enumerate(headers) if key}
        if not any(str(d.get(k,'')).strip() for k in METADATA):
            raise ValueError(f'Data row without metadata at row {row_number}')
        for k in METADATA:
            if not isinstance(d.get(k),str) or not d[k].strip() or d[k].startswith(('=','@')):
                raise ValueError(f'Invalid {k} at row {row_number}')
        title,published,kind=[d[k] for k in METADATA]
        if kind not in ('图文','视频'):raise ValueError(f'Unknown 体裁 at row {row_number}')
        identity=(title,published)
        if identity in identities:raise ValueError(f'Duplicate note row / 重复笔记行: {row_number}')
        identities.add(identity);entry=mapping.get(identity)
        note_id=entry['noteId'] if entry else None
        if note_id and note_id in note_ids:raise ValueError('One confirmed noteId occurs twice in this snapshot')
        if note_id:note_ids.add(note_id)
        raw={k:d.get(k,'') for k in METRICS};values={k:numeric(v,k) for k,v in raw.items()}
        notes.append({'title':title,'publishedAt':published,'format':kind,'metrics':values,'rawMetrics':raw,'sourceRow':row_number,'noteId':note_id,'workId':entry.get('workId') if entry else None,'identityStatus':'confirmed' if entry else 'candidate','candidateKey':digest([title,published]),'producer':entry.get('producer',producer) if entry else producer,'paid':paid,'durationUnit':'unknown'})
    if not notes:raise ValueError('No note rows found')
    content_hash=digest(notes)
    payload={'schemaVersion':1,'platform':'xiaohongshu','capturedAt':captured,'source':{'fileName':path.name,'sha256':digest(path.read_bytes()),'sheet':sheet,'headerRow':h+1},'contentHash':content_hash,'notes':notes,'summary':summarize(notes),'byFormat':{kind:summarize([n for n in notes if n['format']==kind]) for kind in ('图文','视频') if any(n['format']==kind for n in notes)},'warnings':[]}
    if captured is None:payload['warnings'].append('缺少统计截点，不能比较同发布年龄或计算快照增量。')
    if paid=='unknown':payload['warnings'].append('未提供投放状态，不能默认自然流量。')
    if any(n['noteId'] is None for n in notes):payload['warnings'].append('存在候选身份，不能按标题自动确认发布笔记或关联改名后的笔记。')
    payload['warnings']+=['人均观看时长单位未提供；不计算完播率。','评论未区分读者与作者回复；不当作咨询人数。','每份快照保留累计值；不可把多次快照相加当作累计或增量。']
    payload['snapshotId']=digest(payload)
    return payload

def is_skill_installation(entry):
    with entry.open(encoding='utf-8-sig') as f:lines=f.read(65536).splitlines()
    if not lines or lines[0].strip()!='---':return False
    end=next((i for i,line in enumerate(lines[1:],1) if line.strip() in ('---','...')),None)
    if end is None:return False
    keys=[]
    for line in lines[1:end]:
        match=re.match(r'^([ \t]*)([A-Za-z_][A-Za-z0-9_-]*)\s*:',line)
        if match:keys.append((len(match.group(1)),line))
    if not keys:return False
    root_indent=min(indent for indent,_ in keys)
    identity=re.compile(r'''^[ \t]*name\s*:\s*(['"]?)austria-study-career-content\1\s*(?:#.*)?$''')
    return any(indent==root_indent and identity.fullmatch(line) for indent,line in keys)

def private_output(out):
    path=Path(out)
    if not path.is_absolute():raise ValueError('Output must be an absolute private directory')
    resolved=path.resolve();skill=Path(__file__).resolve().parents[1]
    if resolved==skill or skill in resolved.parents:raise ValueError('Output must stay outside the public skill / 输出必须在仓库外')
    for parent in [resolved,*resolved.parents]:
        entry=parent/'SKILL.md'
        if entry.is_file() and is_skill_installation(entry):
            raise ValueError('Output must stay outside every public skill installation / 输出必须在仓库外')
    return resolved

def atomic_json(path,value):
    fd,tmp=tempfile.mkstemp(prefix='.metrics-',suffix='.tmp',dir=path.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf-8',newline='\n') as f:f.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def save_snapshot(snapshot,out):
    directory=private_output(out)
    if snapshot.get('snapshotId')!=digest({k:v for k,v in snapshot.items() if k!='snapshotId'}):
        raise ValueError('Snapshot integrity check failed')
    directory.mkdir(parents=True,exist_ok=True);lock=directory/'.import.lock'
    try:lock.mkdir()
    except FileExistsError as exc:raise ValueError('Import is locked by another writer; do not remove an active lock') from exc
    try:
        folder=directory/'snapshots';folder.mkdir(exist_ok=True)
        if folder.is_symlink() or folder.resolve().parent!=directory:
            raise ValueError('Snapshot directory must not redirect outside the private output')
        target=folder/(snapshot['snapshotId']+'.json');existed=target.exists()
        if target.is_symlink() or (directory/'review.json').is_symlink():raise ValueError('Output files must not be symlinks')
        if existed:
            try:existing=json.loads(target.read_text(encoding='utf-8'))
            except (ValueError,UnicodeDecodeError) as exc:raise ValueError('Existing snapshot is corrupt') from exc
            if existing!=snapshot:raise ValueError('Existing snapshot differs; refusing overwrite')
        else:atomic_json(target,snapshot)
        review={'snapshotId':snapshot['snapshotId'],'capturedAt':snapshot['capturedAt'],'summary':snapshot['summary'],'byFormat':snapshot['byFormat'],'warnings':snapshot['warnings'],'scope':'本地导出快照核算；不含账户访问、评论原文、咨询归因或算法判断'}
        atomic_json(directory/'review.json',review)
        return {'snapshotId':snapshot['snapshotId'],'snapshotPath':str(target),'reviewPath':str(directory/'review.json'),'alreadyExists':existed}
    finally:lock.rmdir()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--captured-at')
    parser.add_argument('--paid',choices=['unknown','yes','no'],default='unknown')
    parser.add_argument('--producer',choices=['unknown','Codex','WorkBuddy','other'],default='unknown')
    parser.add_argument('--note-map',type=Path)
    args=parser.parse_args()
    try:
        private_output(args.out)
        snapshot=build_snapshot(args.input,args.captured_at,args.paid,args.producer,args.note_map)
        result=save_snapshot(snapshot,args.out)
        print(json.dumps({**result,'count':len(snapshot['notes']),'totals':snapshot['summary']['totals'],'warnings':snapshot['warnings']},ensure_ascii=False,indent=2))
    except (ValueError,OSError,ET.ParseError) as exc:parser.exit(1,f'Import failed: {exc}\n')

if __name__=='__main__':main()
