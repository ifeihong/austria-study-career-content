import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile
from xml.sax.saxutils import escape

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/import-xhs-metrics.py'
spec = importlib.util.spec_from_file_location('xhs_metrics', SCRIPT)
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)

HEADERS = ['笔记标题', '首次发布时间', '体裁', '曝光', '观看量', '封面点击率', '点赞', '评论', '收藏', '涨粉', '分享', '人均观看时长', '弹幕']
ROW = ['测试生活问题', '2026年11月01日18时00分00秒', '图文', '100', '20', '12.5%', '1', '0', '2', '', '0', '14', '0']

def make_xlsx(path, sheets, formula=False, row_start=1):
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with ZipFile(path, 'w') as z:
        entries = ''.join(f'<sheet name="Sheet{i}" sheetId="{i}" r:id="rId{i}"/>' for i in range(1, len(sheets)+1))
        z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>{entries}</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{i}" Type="{rel}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))+'</Relationships>')
        for i, rows in enumerate(sheets,1):
            body=''
            for n,row in enumerate(rows,1):
                actual=n+row_start-1
                cells=''
                for j,v in enumerate(row):
                    col=chr(65+j)
                    if formula and n==2 and j==3:cells+=f'<c r="{col}{actual}"><f>1+1</f><v>2</v></c>'
                    else:cells+=f'<c r="{col}{actual}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>'
                body+=f'<row r="{actual}">{cells}</row>'
            z.writestr(f'xl/worksheets/sheet{i}.xml', f'<worksheet xmlns="{ns}"><sheetData>{body}</sheetData></worksheet>')

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def csv(self, rows=None):
        p=self.root/'input.csv'
        with p.open('w',encoding='utf-8-sig',newline='') as f:
            csv.writer(f).writerows([HEADERS]+(rows or [ROW]))
        return p
    def test_counts_ctr_and_missing_are_not_inferred(self):
        snap=metrics.build_snapshot(self.csv())
        r=snap['notes'][0]
        self.assertEqual(r['metrics']['封面点击率'],.125)
        self.assertEqual(r['metrics']['评论'],0)
        self.assertIsNone(r['metrics']['涨粉'])
        self.assertIsNone(snap['capturedAt'])
        self.assertEqual(r['producer'],'unknown')
        self.assertEqual(r['durationUnit'],'unknown')
        self.assertIsNone(r['noteId'])
        self.assertEqual(snap['summary']['totals']['观看量'],20)
        self.assertIsNone(snap['summary']['totals']['涨粉'])
    def test_xlsx_skips_export_preamble_and_selects_unique_data_sheet(self):
        p=self.root/'input.xlsx';make_xlsx(p,[[['说明']],[['最多导出前1000条'],HEADERS,ROW]])
        snap=metrics.build_snapshot(p)
        self.assertEqual(len(snap['notes']),1)
        self.assertEqual(snap['notes'][0]['sourceRow'],3)
        self.assertEqual(snap['source']['sheet'],'Sheet2')
    def test_ambiguous_sheets_and_formula_fail(self):
        p=self.root/'input.xlsx';make_xlsx(p,[[HEADERS,ROW],[HEADERS,ROW]])
        with self.assertRaisesRegex(ValueError,'unique|唯一'):metrics.build_snapshot(p)
        make_xlsx(p,[[HEADERS,ROW]],formula=True)
        with self.assertRaisesRegex(ValueError,'formula|公式'):metrics.build_snapshot(p)
    def test_invalid_numeric_ctr_and_duplicate_rows_fail(self):
        for index,value in [(3,'-1'),(3,'NaN'),(5,'13.5'),(6,'1.5')]:
            row=ROW.copy();row[index]=value
            with self.subTest(index=index,value=value),self.assertRaises(ValueError):metrics.build_snapshot(self.csv([row]))
        row=ROW.copy();row[3]='101'
        with self.assertRaisesRegex(ValueError,'duplicate|重复'):metrics.build_snapshot(self.csv([ROW,row]))
    def test_confirmed_mapping_and_capture_idempotency(self):
        p=self.csv();mapping=self.root/'map.json'
        mapping.write_text(json.dumps([{'title':ROW[0],'publishedAt':ROW[1],'noteId':'note-demo','workId':'work-demo'}]),encoding='utf-8')
        a=metrics.build_snapshot(p,captured_at='2026-11-04T12:00:00+08:00',note_map=mapping)
        self.assertEqual(a['notes'][0]['noteId'],'note-demo')
        self.assertEqual(a['notes'][0]['identityStatus'],'confirmed')
        out=self.root/'private'
        first=metrics.save_snapshot(a,out);second=metrics.save_snapshot(a,out)
        self.assertFalse(first['alreadyExists']);self.assertTrue(second['alreadyExists'])
        b=metrics.build_snapshot(p,captured_at='2026-11-05T12:00:00+08:00',note_map=mapping)
        self.assertNotEqual(a['snapshotId'],b['snapshotId'])
        self.assertEqual(len(list((out/'snapshots').glob('*.json'))),1)
    def test_output_private_boundary_and_capture_timezone(self):
        with self.assertRaisesRegex(ValueError,'outside|仓库外'):metrics.save_snapshot(metrics.build_snapshot(self.csv()), SCRIPT.parent.parent/'private-test')
        with self.assertRaisesRegex(ValueError,'timezone|时区'):metrics.build_snapshot(self.csv(),captured_at='2026-11-04T12:00:00')
    def test_archive_traversal_and_doctype_rejected(self):
        p=self.root/'input.xlsx';make_xlsx(p,[[HEADERS,ROW]])
        with ZipFile(p,'a') as z:z.writestr('../escape.xml','x')
        with self.assertRaises(ValueError):metrics.build_snapshot(p)
        with ZipFile(p,'w') as z:z.writestr('xl/workbook.xml','<!DOCTYPE x><x/>')
        with self.assertRaises(ValueError):metrics.build_snapshot(p)
    def test_missing_statistic_does_not_silently_make_partial_total(self):
        row=ROW.copy();row[3]=''
        snap=metrics.build_snapshot(self.csv([row]))
        self.assertIsNone(snap['summary']['totals']['曝光'])
        self.assertEqual(snap['summary']['knownTotals']['曝光'],0)
        self.assertEqual(snap['summary']['missingCounts']['曝光'],1)
    def test_later_snapshot_is_saved_separately_and_corruption_fails(self):
        p=self.csv();out=self.root/'private'
        a=metrics.build_snapshot(p,captured_at='2026-11-04T12:00:00Z')
        b=metrics.build_snapshot(p,captured_at='2026-11-05T12:00:00Z')
        first=metrics.save_snapshot(a,out);metrics.save_snapshot(b,out)
        self.assertEqual(len(list((out/'snapshots').glob('*.json'))),2)
        Path(first['snapshotPath']).write_text('{}',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'differs'):metrics.save_snapshot(a,out)
    def test_existing_lock_is_not_deleted(self):
        out=self.root/'private';out.mkdir();(out/'.import.lock').mkdir()
        with self.assertRaisesRegex(ValueError,'locked'):metrics.save_snapshot(metrics.build_snapshot(self.csv()),out)
        self.assertTrue((out/'.import.lock').is_dir())
    def test_sparse_xlsx_rows_keep_actual_source_coordinate(self):
        p=self.root/'input.xlsx';make_xlsx(p,[[HEADERS,ROW]],row_start=7)
        snap=metrics.build_snapshot(p)
        self.assertEqual(snap['source']['headerRow'],7)
        self.assertEqual(snap['notes'][0]['sourceRow'],8)
    def test_other_installation_frontmatter_names_are_blocked(self):
        installation=self.root/'other-skill';installation.mkdir()
        for name in ['name: "austria-study-career-content"',"name: 'austria-study-career-content'",'  name  :  austria-study-career-content  # identity']:
            with self.subTest(name=name):
                (installation/'SKILL.md').write_text('---\n'+name+'\n---\n正文\n',encoding='utf-8')
                with self.assertRaisesRegex(ValueError,'outside|仓库外'):metrics.private_output(installation/'data')
    def test_body_name_and_nested_metadata_do_not_identify_installation(self):
        folder=self.root/'ordinary-docs';folder.mkdir()
        for content in ['name: austria-study-career-content\n无前置信息', '---\nname: another-skill\n---\n示例 name: austria-study-career-content', '---\nname: another-skill\nmetadata:\n  name: austria-study-career-content\n---']:
            with self.subTest(content=content):
                (folder/'SKILL.md').write_text(content,encoding='utf-8')
                self.assertEqual(metrics.private_output(folder/'data'),(folder/'data').resolve())
    def test_blank_formatting_columns_are_accepted_but_unnamed_data_is_not(self):
        p=self.root/'formatting.xlsx'
        make_xlsx(p,[[HEADERS+['',''],ROW+['','']]])
        snap=metrics.build_snapshot(p)
        self.assertEqual(snap['notes'][0]['metrics']['观看量'],20)
        self.assertEqual(snap['notes'][0]['sourceRow'],2)
        make_xlsx(p,[[HEADERS+['',''],ROW+['hidden','']]])
        with self.assertRaisesRegex(ValueError,'Unnamed|无表头'):metrics.build_snapshot(p)
        make_xlsx(p,[[HEADERS+['曝光'],ROW+['100']]])
        with self.assertRaisesRegex(ValueError,'Duplicate|重复'):metrics.build_snapshot(p)

if __name__=='__main__':unittest.main()
