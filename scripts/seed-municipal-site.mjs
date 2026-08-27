#!/usr/bin/env node
/**
 * Seeds the demo municipal site: page structure, menus and CMS content.
 *
 * The demo content existed only as hand-made rows in a running database, so a
 * `docker compose down -v` erased it and nobody could rebuild it. Everything it
 * needs now lives here and the script is idempotent, so it can be run against a
 * fresh stack or an existing one.
 *
 *   node scripts/seed-municipal-site.mjs [--platform plateform-obt]
 *
 * Page structure is stored in the control plane; articles and pages live in the
 * platform's own database, so the script writes to both.
 */

import { Client } from 'pg';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const PLATFORM_SLUG = readArg('platform', 'plateform-obt');
// Matches the compose defaults; override with CORE_DATABASE_URL when they differ.
const CORE_URL = process.env.CORE_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? 'postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core';

const AGENCY = {
  name: 'เทศบาลตำบลตัวอย่าง',
  nameEn: 'Tambon Tuayang Municipality',
  slogan: 'บริการด้วยใจ โปร่งใส ตรวจสอบได้',
  district: 'อำเภอเมือง จังหวัดศรีสะเกษ',
  address: 'เลขที่ 99 หมู่ 1 ตำบลตัวอย่าง อำเภอเมือง จังหวัดศรีสะเกษ 33000',
  phone: '045-000000',
  fax: '045-000001',
  email: 'saraban@example.go.th',
  officeHours: 'จันทร์ – ศุกร์ เวลา 08.30 – 16.30 น. (เว้นวันหยุดราชการและวันหยุดนักขัตฤกษ์)',
};

/* ---------------------------------------------------------------- categories */
const CATEGORIES = [
  { id: 1, name: 'ข่าวประชาสัมพันธ์' },
  { id: 2, name: 'ข่าวกิจกรรม' },
  { id: 3, name: 'ประกาศจัดซื้อจัดจ้าง' },
  { id: 4, name: 'ข่าวรับสมัครงาน โอน/ย้าย' },
];

const POSTS = [
  {
    category: 3,
    name: 'ประกาศประกวดราคาจ้างก่อสร้างถนนคอนกรีตเสริมเหล็ก สายบ้านตัวอย่าง – บ้านหนองแสง',
    description:
      '<p>เทศบาลตำบลตัวอย่าง มีความประสงค์จะประกวดราคาจ้างก่อสร้างถนนคอนกรีตเสริมเหล็ก '
      + 'สายบ้านตัวอย่าง – บ้านหนองแสง ผิวจราจรกว้าง 5.00 เมตร ยาว 1,200 เมตร หนา 0.15 เมตร '
      + 'ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์ (e-bidding)</p>'
      + '<p>ผู้สนใจสามารถขอรับเอกสารประกวดราคาผ่านระบบจัดซื้อจัดจ้างภาครัฐ '
      + 'หรือสอบถามเพิ่มเติมได้ที่กองคลัง ในวันและเวลาราชการ</p>',
    days: 2,
  },
  {
    category: 3,
    name: 'ประกาศเผยแพร่แผนการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. 2569',
    description:
      '<p>ตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 '
      + 'เทศบาลตำบลตัวอย่างขอเผยแพร่แผนการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. 2569 '
      + 'เพื่อให้การดำเนินการเป็นไปด้วยความโปร่งใสและตรวจสอบได้</p>',
    days: 6,
  },
  {
    category: 3,
    name: 'ประกาศราคากลางงานปรับปรุงระบบประปาหมู่บ้าน หมู่ที่ 3',
    description:
      '<p>เทศบาลตำบลตัวอย่างขอประกาศราคากลางงานปรับปรุงระบบประปาหมู่บ้าน หมู่ที่ 3 '
      + 'วงเงินงบประมาณตามที่ได้รับจัดสรร พร้อมรายละเอียดการคำนวณราคากลางตามแบบ ปร.4 และ ปร.5</p>',
    days: 11,
  },
  {
    category: 4,
    name: 'รับสมัครบุคคลเพื่อสรรหาและเลือกสรรเป็นพนักงานจ้างตามภารกิจ ตำแหน่งผู้ช่วยนายช่างโยธา',
    description:
      '<p>เทศบาลตำบลตัวอย่างรับสมัครบุคคลเพื่อสรรหาและเลือกสรรเป็นพนักงานจ้างตามภารกิจ '
      + 'ตำแหน่งผู้ช่วยนายช่างโยธา จำนวน 1 อัตรา ผู้สนใจยื่นใบสมัครด้วยตนเองที่งานการเจ้าหน้าที่ '
      + 'สำนักปลัดเทศบาล ในวันและเวลาราชการ</p>',
    days: 4,
  },
  {
    category: 4,
    name: 'ประกาศรับโอน (ย้าย) พนักงานเทศบาล ตำแหน่งนักวิชาการเงินและบัญชี',
    description:
      '<p>ด้วยเทศบาลตำบลตัวอย่างมีความประสงค์รับโอน (ย้าย) พนักงานเทศบาล '
      + 'ตำแหน่งนักวิชาการเงินและบัญชี ระดับปฏิบัติการ/ชำนาญการ จำนวน 1 อัตรา '
      + 'ผู้ประสงค์ขอโอน (ย้าย) ยื่นเอกสารได้ที่กองคลัง</p>',
    days: 9,
  },
];


/**
 * Enough entries for a listing to page.
 *
 * Three articles per category left every pager hidden and page two empty, so
 * the feature could not be seen working. These are plainly sample text; the
 * agency replaces them with its own.
 */
const FILLER = [
  [1, 'ประกาศเทศบาลตำบลตัวอย่าง เรื่อง การรับฟังความคิดเห็นของประชาชนในการจัดทำแผนพัฒนาท้องถิ่น', 14],
  [1, 'ขอเชิญร่วมโครงการคัดแยกขยะต้นทางในครัวเรือน ประจำปี 2569', 18],
  [1, 'แจ้งหยุดจ่ายน้ำประปาชั่วคราวเพื่อซ่อมบำรุงระบบท่อเมนหลัก หมู่ที่ 5 และ 6', 22],
  [1, 'ประชาสัมพันธ์การขึ้นทะเบียนผู้สูงอายุเพื่อรับเบี้ยยังชีพ ประจำปีงบประมาณ 2570', 27],
  [1, 'ประกาศผลการประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของหน่วยงานภาครัฐ (ITA)', 31],
  [2, 'โครงการเทศบาลเคลื่อนที่พบประชาชน ประจำเดือนสิงหาคม 2569', 12],
  [2, 'กิจกรรมวันแม่แห่งชาติ ประจำปี 2569 ณ ลานอเนกประสงค์เทศบาล', 16],
  [2, 'โครงการฝึกอบรมชุดปฏิบัติการจิตอาสาภัยพิบัติประจำองค์กรปกครองส่วนท้องถิ่น', 20],
  [2, 'กิจกรรมปลูกต้นไม้เฉลิมพระเกียรติ เนื่องในวันเฉลิมพระชนมพรรษา', 25],
  [2, 'โครงการส่งเสริมสุขภาพผู้สูงอายุ กิจกรรมออกกำลังกายเพื่อสุขภาพ', 29],
  [3, 'ประกาศผู้ชนะการเสนอราคา จ้างเหมาบริการกำจัดขยะมูลฝอย ประจำปีงบประมาณ 2569', 15],
  [3, 'ประกาศประกวดราคาจ้างก่อสร้างรางระบายน้ำคอนกรีตเสริมเหล็ก หมู่ที่ 7', 19],
  [3, 'ประกาศเผยแพร่แผนการจัดซื้อจัดจ้าง ประจำไตรมาสที่ 4 ปีงบประมาณ 2569', 24],
  [3, 'ประกาศราคากลางงานจัดซื้อครุภัณฑ์คอมพิวเตอร์ สำนักปลัดเทศบาล', 28],
  [4, 'ประกาศรายชื่อผู้มีสิทธิเข้ารับการสรรหาและเลือกสรรเป็นพนักงานจ้าง', 13],
  [4, 'ประกาศผลการสรรหาและเลือกสรรบุคคลเป็นพนักงานจ้างตามภารกิจ', 17],
].map(([category, name, days]) => ({
  category,
  name,
  description:
    `<p>${name}</p><p>รายละเอียดเพิ่มเติมติดต่อได้ที่สำนักงาน${AGENCY.name} `
    + `โทรศัพท์ ${AGENCY.phone} ในวันและเวลาราชการ</p>`
    + '<p><em>ข้อความตัวอย่างสำหรับทดสอบการแสดงผล</em></p>',
  days,
}));

/* -------------------------------------------------------------------- pages */
const CMS_PAGES = [
  {
    slug: 'vision',
    name: 'วิสัยทัศน์และพันธกิจ',
    description:
      '<h2>วิสัยทัศน์</h2><p>“ตำบลน่าอยู่ ประชาชนมีคุณภาพชีวิตที่ดี บริหารงานโปร่งใส '
      + 'ใส่ใจสิ่งแวดล้อม พร้อมก้าวสู่ท้องถิ่นดิจิทัล”</p>'
      + '<h2>พันธกิจ</h2><ul>'
      + '<li>พัฒนาโครงสร้างพื้นฐานให้ได้มาตรฐานและทั่วถึงทุกหมู่บ้าน</li>'
      + '<li>ส่งเสริมคุณภาพชีวิต การศึกษา และการสาธารณสุขของประชาชน</li>'
      + '<li>บริหารจัดการทรัพยากรธรรมชาติและสิ่งแวดล้อมอย่างยั่งยืน</li>'
      + '<li>บริหารงานตามหลักธรรมาภิบาล โปร่งใส และเปิดเผยข้อมูลต่อสาธารณะ</li>'
      + '</ul>',
  },
  {
    slug: 'authority',
    name: 'อำนาจหน้าที่',
    description:
      '<p>เทศบาลตำบลมีอำนาจหน้าที่ตามพระราชบัญญัติเทศบาล พ.ศ. 2496 และที่แก้ไขเพิ่มเติม '
      + 'รวมถึงพระราชบัญญัติกำหนดแผนและขั้นตอนการกระจายอำนาจให้แก่องค์กรปกครองส่วนท้องถิ่น พ.ศ. 2542 '
      + 'โดยมีหน้าที่หลัก ดังนี้</p><ul>'
      + '<li>รักษาความสงบเรียบร้อยและความปลอดภัยของประชาชน</li>'
      + '<li>จัดให้มีและบำรุงรักษาทางบก ทางน้ำ และทางระบายน้ำ</li>'
      + '<li>จัดการศึกษา ส่งเสริมศาสนา ศิลปวัฒนธรรม และภูมิปัญญาท้องถิ่น</li>'
      + '<li>ป้องกันและระงับโรคติดต่อ และส่งเสริมการสาธารณสุข</li>'
      + '<li>ส่งเสริมการพัฒนาอาชีพและเศรษฐกิจชุมชน</li>'
      + '</ul>',
  },
];

/* -------------------------------------------------------- page tree helpers */
const nav = [
  {
    label: 'หน้าหลัก',
    href: '/'
  },
  {
    label: 'ข้อมูลพื้นฐาน',
    children: [
      {
        label: 'ข้อมูลพื้นฐาน',
        children: [
          {
            label: 'ประวัติและข้อมูลสภาพทั่วไป',
            href: '/about'
          },
          {
            label: 'ตราสัญลักษณ์',
            href: '/about'
          },
          {
            label: 'วิสัยทัศน์และพันธกิจ',
            href: '/vision'
          },
          {
            label: 'ผู้นำชุมชน',
            href: '/personnel'
          },
          {
            label: 'โครงสร้างหน่วยงาน',
            href: '/structure'
          },
          {
            label: 'องค์กรสุขภาวะ (Happy Workplace)',
            href: '/about'
          },
          {
            label: 'มาตรฐานกำหนดตำแหน่ง เทศบาลฯ',
            href: '/documents'
          }
        ]
      },
      {
        label: 'นโยบายของผู้บริหาร',
        children: [
          {
            label: 'คำแถลงนโยบายของผู้บริหาร',
            href: '/about'
          },
          {
            label: 'เจตจำนงสุจริตของผู้บริหาร',
            href: '/about'
          },
          {
            label: 'นโยบายไม่รับของขวัญ No Gift Policy',
            href: '/about'
          }
        ]
      },
      {
        label: 'ภารกิจ อำนาจหน้าที่ และความรับผิดชอบ',
        children: [
          {
            label: 'อำนาจหน้าที่ของเทศบาลตำบลปทุม',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของสำนักปลัดเทศบาล',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของกองคลัง',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของกองช่าง',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของกองการศึกษา',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของกองสาธารณสุขและสิ่งแวดล้อม',
            href: '/authority'
          },
          {
            label: 'อำนาจหน้าที่ของหน่วยตรวจสอบภายใน',
            href: '/authority'
          }
        ]
      },
      {
        label: 'ทำเนียบบุคลากร',
        children: [
          {
            label: 'คณะผู้บริหาร',
            href: '/personnel'
          },
          {
            label: 'สมาชิกสภาเทศบาล',
            href: '/personnel'
          },
          {
            label: 'หัวหน้าส่วนราชการ',
            href: '/personnel'
          },
          {
            label: 'สำนักปลัดเทศบาล',
            href: '/about'
          },
          {
            label: 'หน่วยตรวจสอบภายใน',
            href: '/about'
          },
          {
            label: 'กองคลัง',
            href: '/about'
          },
          {
            label: 'กองช่าง',
            href: '/about'
          },
          {
            label: 'กองการศึกษา',
            href: '/about'
          },
          {
            label: 'กองสาธารณสุขและสิ่งแวดล้อม',
            href: '/about'
          }
        ]
      },
      {
        label: 'ข้อมูลในพื้นที่',
        children: [
          {
            label: 'ผลผลิตทางการเกษตร',
            href: '/about'
          },
          {
            label: 'ผลิตภัณฑ์ชุมชน/ภูมิปัญญาท้องถิ่น',
            href: '/about'
          },
          {
            label: 'แนะนำแหล่งท่องเที่ยวและสถานที่สำคัญ',
            href: '/about'
          }
        ]
      },
      {
        label: 'คู่มือการปฏิบัติงาน',
        children: [
          {
            label: 'คู่มือและมาตรฐานการปฏิบัติงาน',
            href: '/documents'
          },
          {
            label: 'หลักเกณฑ์การบริหารและพัฒนาทรัพยากรบุคคล',
            href: '/documents'
          }
        ]
      }
    ]
  },
  {
    label: 'ศูนย์ข้อมูลข่าวสาร',
    children: [
      {
        label: 'ข่าวสารประชาสัมพันธ์',
        children: [
          {
            label: 'จดหมายข่าว',
            href: '/news'
          },
          {
            label: 'ข่าวประชาสัมพันธ์/ข่าวประกาศ',
            href: '/news'
          },
          {
            label: 'กิจกรรม/ผลงาน',
            href: '/activity'
          },
          {
            label: 'ข่าวรับสมัครงาน โอน/ย้าย',
            href: '/documents'
          },
          {
            label: 'ITA',
            href: '/about'
          },
          {
            label: 'LPA',
            href: '/about'
          },
          {
            label: 'ฐานข้อมูลเปิดภาครัฐ (OPEN DATA)',
            href: '/about'
          },
          {
            label: 'การเปิดโอกาสการมีส่วนร่วม',
            href: '/about'
          }
        ]
      },
      {
        label: 'การดำเนินงานของหน่วยงาน',
        children: [
          {
            label: 'แผนการดำเนินงานและงบประมาณประจำปี',
            href: '/documents'
          },
          {
            label: 'แผนพัฒนาท้องถิ่น',
            href: '/documents'
          },
          {
            label: 'แผนยุทธศาสตร์การพัฒนา',
            href: '/documents'
          },
          {
            label: 'แผนอัตรากำลัง',
            href: '/documents'
          },
          {
            label: 'แผนพัฒนาบุคลากร',
            href: '/documents'
          },
          {
            label: 'แผนปฏิบัติการป้องกันการทุจริต',
            href: '/documents'
          },
          {
            label: 'การบริหารความเสี่ยง เพื่อป้องกันการทุจริตภายในหน่วยงาน',
            href: '/documents'
          },
          {
            label: 'งานตรวจสอบภายใน',
            href: '/documents'
          },
          {
            label: 'งานบริหารและพัฒนาทรัพยากรบุคคล',
            href: '/documents'
          },
          {
            label: 'งานจริยธรรม',
            href: '/documents'
          }
        ]
      },
      {
        label: 'การดำเนินงานของหน่วยงาน',
        children: [
          {
            label: 'การลดขั้นตอนการปฎิบัติงาน',
            href: '/documents'
          },
          {
            label: 'มาตรการภายใน',
            href: '/about'
          },
          {
            label: 'แนวปฏิบัติการจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ',
            href: '/services'
          },
          {
            label: 'การประเมินความเสี่ยงเพื่อป้องกันการทุจริต',
            href: '/documents'
          },
          {
            label: 'ข้อมูลเชิงสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบประจำปี',
            href: '/documents'
          }
        ]
      },
      {
        label: 'การกำกับและติดตามการดำเนินงานตามแผน',
        children: [
          {
            label: 'รายงานติดตามและประเมินผลแผนฯ',
            href: '/documents'
          },
          {
            label: 'การโอนงบประมาณรายจ่ายประจำปี',
            href: '/documents'
          }
        ]
      },
      {
        label: 'เอกสาร/รายงาน',
        children: [
          {
            label: 'รายงานข้อมูลทางการเงิน',
            href: '/documents'
          },
          {
            label: 'รายงานผลการดำเนินงาน',
            href: '/documents'
          },
          {
            label: 'รายงานการประชุม',
            href: '/documents'
          },
          {
            label: 'รายงานผลการสำรวจความพึงพอใจการให้บริการ',
            href: '/documents'
          }
        ]
      },
      {
        label: 'ข้อมูลที่เกี่ยวข้อง',
        children: [
          {
            label: 'เทศบัญญัติงบประมาณ',
            href: '/authority'
          },
          {
            label: 'เทศบัญญัติท้องถิ่น',
            href: '/authority'
          },
          {
            label: 'กฎหมายและระเบียบท้องถิ่น เทศบาลตำบล',
            href: '/authority'
          },
          {
            label: 'คำสั่ง ทต.',
            href: '/authority'
          },
          {
            label: 'ประมวลจริยธรรมสำหรับเจ้าหน้าที่รัฐ',
            href: '/authority'
          },
          {
            label: 'การขออนุมัติใช้เงินสะสม/การได้รับการจัดสรรเงินอุดหนุนเฉพาะกิจ',
            href: '/about'
          }
        ]
      },
      {
        label: 'กฎหมายท้องถิ่น',
        children: [
          {
            label: 'พรบ./พรก.',
            href: '/authority'
          },
          {
            label: 'กฎระเบียบกระทรวง',
            href: '/authority'
          },
          {
            label: 'คำสั่ง สถ.',
            href: '/authority'
          },
          {
            label: 'มติ ก.อบจ.',
            href: '/authority'
          },
          {
            label: 'มติ ก.เทศบาล.',
            href: '/authority'
          },
          {
            label: 'มติ ก.อบต.',
            href: '/authority'
          }
        ]
      },
      {
        label: 'งานกิจการสภา',
        children: [
          {
            label: 'รายงานกิจการสภา',
            href: '/documents'
          },
          {
            label: 'ข้อมูลการจัดซื้อจัดจ้าง',
            href: '/procurement'
          }
        ]
      }
    ]
  },
  {
    label: 'ข้อมูลการจัดซื้อจัดจ้าง',
    href: '/procurement'
  },
  {
    label: 'บริการประชาชน',
    children: [
      {
        label: 'บริการประชาชน',
        children: [
          {
            label: 'รับเรื่องร้องเรียนร้องทุกข์',
            href: '/contact'
          },
          {
            label: 'คลังความรู้',
            href: '/services'
          },
          {
            label: 'ช่องทางร้องเรียนทุจริต',
            href: '/contact'
          },
          {
            label: 'รับฟังความคิดเห็น',
            href: '/contact'
          },
          {
            label: 'คำถาม คำตอบ (Q&A)',
            href: '/contact'
          },
          {
            label: 'แบบสอบถามความพึงพอใจในการให้บริการของหน่วยงาน',
            href: '/documents'
          },
          {
            label: 'แบบสอบถามความพึงพอใจในการให้บริการเว็บไซต์',
            href: '/services'
          }
        ]
      },
      {
        label: 'บริการออนไลน์',
        children: [
          {
            label: 'คู่มือหรือมาตรฐานการให้บริการ',
            href: '/documents'
          },
          {
            label: 'e-Service',
            href: '/services'
          },
          {
            label: 'การลดขั้นตอนการปฏิบัติงาน',
            href: '/documents'
          },
          {
            label: 'สถิติการให้บริการประชาชน',
            href: '/documents'
          }
        ]
      },
      {
        label: 'บริการอื่น ๆ',
        children: [
          {
            label: 'อปพร.',
            href: '/services'
          },
          {
            label: 'กู้ชีพ',
            href: '/services'
          }
        ]
      }
    ]
  },
  {
    label: 'เกี่ยวกับเรา',
    children: [
      {
        label: 'เกี่ยวกับเรา',
        children: [
          {
            label: 'ติดต่อเรา',
            href: '/contact'
          },
          {
            label: 'แผนผังเว็บไซต์',
            href: '/documents'
          },
          {
            label: 'ข้อกำหนดการใช้งานเว็บไซต์',
            href: '/documents'
          },
          {
            label: 'นโยบายความเป็นส่วนตัวในการใช้งานเว็บไซต์',
            href: '/documents'
          },
          {
            label: 'คำถามที่พบบ่อย',
            href: '/about'
          },
          {
            label: 'เข้าสู่ระบบ',
            href: '/about'
          }
        ]
      }
    ]
  }
];

/**
 * The side menu mirrors the main one, but flattened: its middle level is group
 * headings, which are not pages, so a visitor clicking one would go nowhere.
 */
const sidebarItems = (activeHref) => {
  const leaves = (item) =>
    (item.children ?? []).flatMap((child) => (child.children?.length ? child.children : [child]));

  return nav
    .filter((item) => item.href !== '/')
    .map((item) => {
      const children = leaves(item).map((leaf) => ({
        ...leaf,
        ...(leaf.href === activeHref ? { active: true } : {}),
      }));
      return {
        label: item.label,
        ...(item.href ? { href: item.href } : {}),
        ...(children.length ? { children } : {}),
        ...(item.href === activeHref || children.some((c) => c.active) ? { active: true } : {}),
      };
    });
};

/** Every mock asset says so, so nobody mistakes one for the agency's own. */
const MOCK_ALT = 'ภาพประกอบตัวอย่าง — ยังไม่ได้อัปโหลดภาพจริงของหน่วยงาน';
const MOCK_PERSON_NOTE =
  'ยังไม่ได้อัปโหลดภาพถ่ายจริง — ภาพผู้บริหารต้องเป็นภาพถ่ายของบุคคลนั้นเท่านั้น';

const noticeList = (id, { title, category, page, moreLabel = 'ดูทั้งหมด', limit = 6 }) => ({
  id,
  type: 'NoticeListComponent',
  props: {
    title,
    moreHref: `/${page}`,
    moreLabel,
    dataSource: {
      table: 'cms_post',
      where: { cms_category_id: category },
      orderBy: 'publish_at',
      direction: 'desc',
      limit,
      linkPattern: `/${page}/{id}`,
    },
  },
});

const topbar = () => ({
  id: 'topbar',
  type: 'SiteTopbarComponent',
  props: {
    __chrome: true,
    phone: AGENCY.phone,
    email: AGENCY.email,
    facebookLabel: AGENCY.name,
    facebookUrl: 'https://www.facebook.com/',
    showLanguage: true,
  },
});

const header = (activeHref) => ({
  id: 'header',
  type: 'SiteHeaderComponent',
  props: {
    __chrome: true,
    agencyName: AGENCY.name,
    agencyNameEn: AGENCY.nameEn,
    slogan: AGENCY.slogan,
    emblemUrl: null,
    homeHref: '/',
    items: nav.map((item) => ({
      ...item,
      ...(item.href === activeHref ? { active: true } : {}),
    })),
  },
});

const footer = () => ({
  id: 'footer',
  type: 'SiteFooterComponent',
  props: {
    __chrome: true,
    agencyName: AGENCY.name,
    address: AGENCY.address,
    phone: AGENCY.phone,
    fax: AGENCY.fax,
    email: AGENCY.email,
    officeHours: AGENCY.officeHours,
    appSlug: 'demo-muni',
    groups: [
      {
        title: 'ข่าวสาร',
        links: [
          { label: 'ข่าวประชาสัมพันธ์', href: '/news' },
          { label: 'ข่าวกิจกรรม', href: '/activity' },
          { label: 'จัดซื้อจัดจ้าง', href: '/procurement' },
        ],
      },
      {
        title: 'เกี่ยวกับเรา',
        links: [
          { label: 'ข้อมูลทั่วไป', href: '/about' },
          { label: 'วิสัยทัศน์และพันธกิจ', href: '/vision' },
          { label: 'อำนาจหน้าที่', href: '/authority' },
          { label: 'ติดต่อเรา', href: '/contact' },
        ],
      },
    ],
  },
});

const dock = () => ({
  id: 'dock',
  type: 'FloatingDockComponent',
  props: { __chrome: true, phone: AGENCY.phone },
});

const floatingNotices = () => ({
  id: 'float_notices',
  type: 'FloatingNoticeComponent',
  props: {
    __chrome: true,
    items: [
      { id: 'nacc', sublabel: 'ช่องทางร้องเรียน', label: 'ป.ป.ช.', href: 'https://www.nacc.go.th' },
      { id: 'paco', sublabel: 'ช่องทางร้องเรียน', label: 'ป.ป.ท.', href: 'https://www.pacc.go.th' },
    ],
  },
});

const cookieBar = () => ({
  id: 'cookie',
  type: 'CookieConsentComponent',
  props: { __chrome: true, policyHref: '/privacy' },
});

/**
 * A listing. `more` is off on the page that already shows everything — a
 * "see all" button that links to the page you are on is just a dead control.
 */
/**
 * A grid of links on its own ground.
 *
 * pathum.go.th's home page is largely a directory of transparency and service
 * links grouped this way, alternating a pale band with a formal dark one so the
 * page has rhythm without a background photograph for every section.
 */
const linkGrid = (id, { title, subtitle, items, columns = 4, band = 'soft' }) => ({
  id,
  type: 'ServiceLinksComponent',
  props: { title, subtitle, columns, items, stylePreset: `gov-band-${band}` },
});

const postList = (id, { title, subtitle, category, page, limit = 3, columns = 3, more = true, paginate = false }) => ({
  id,
  type: 'PostListComponent',
  props: {
    title,
    subtitle,
    variant: 'card',
    columns,
    ...(more ? { moreHref: `/${page}`, moreLabel: 'ดูทั้งหมด' } : {}),
    emptyText: 'ยังไม่มีข้อมูลในขณะนี้',
    dataSource: {
      table: 'cms_post',
      where: { cms_category_id: category },
      orderBy: 'publish_at',
      direction: 'desc',
      limit,
      linkPattern: `/${page}/{id}`,
      ...(paginate ? { paginate: true } : {}),
    },
  },
});

const html = (id, content, stylePreset) => ({
  id,
  type: 'DynamicHtmlComponent',
  props: { content, ...(stylePreset ? { stylePreset } : {}) },
});

/** Inner pages share one shape: chrome, then a category menu wrapping content. */
const innerPage = (id, title, seo, activeHref, content) => ({
  id,
  title,
  templateType: 'public_page',
  seo,
  componentTree: [
    topbar(),
    header(activeHref),
    {
      id: `${id}_body`,
      type: 'SiteSidebarMenuComponent',
      props: { title: 'หมวดหมู่', items: sidebarItems(activeHref) },
      children: content,
    },
    footer(),
    dock(),
    floatingNotices(),
    cookieBar(),
  ],
});

const PAGES = [
  /*
   * Section for section against a real municipal portal, in the same order:
   * banner, ticker, search, executives, sidebar + news, alert strip, ITA,
   * e-Service, procurement, jobs, e-GP, video, places, forms, links, map.
   */
  {
    id: 'index',
    title: 'หน้าหลัก',
    isDefaultPage: true,
    templateType: 'public_page',
    seo: {
      title: 'หน้าหลัก',
      description:
        `เว็บไซต์ทางการของ${AGENCY.name} รวมข่าวประชาสัมพันธ์ ข่าวกิจกรรม `
        + 'ประกาศจัดซื้อจัดจ้าง และบริการประชาชนออนไลน์',
      keywords: [AGENCY.name, 'ข่าวประชาสัมพันธ์', 'ข่าวกิจกรรม', 'จัดซื้อจัดจ้าง', 'บริการประชาชน'],
      priority: 1,
      changeFrequency: 'daily',
    },
    componentTree: [
      topbar(),
      header('/'),

      /* 1 · แบนเนอร์หลัก */
      {
        id: 'hero',
        type: 'HeroCarouselComponent',
        props: {
          interval: 7,
          slides: [
            { image: '/img/mock/hero-1.svg', alt: MOCK_ALT, title: AGENCY.name, text: AGENCY.district },
            {
              image: '/img/mock/hero-2.svg', alt: MOCK_ALT,
              title: 'แจ้งเรื่องร้องเรียนออนไลน์',
              text: 'แจ้งปัญหาในพื้นที่ถึงเจ้าหน้าที่ได้ตลอด 24 ชั่วโมง ติดตามสถานะได้ด้วยตนเอง',
              href: '/services',
            },
            {
              image: '/img/mock/hero-3.svg', alt: MOCK_ALT,
              title: 'ประกาศจัดซื้อจัดจ้าง',
              text: 'เปิดเผยแผน ราคากลาง และผลการจัดซื้อจัดจ้างตามหลักธรรมาภิบาล',
              href: '/procurement',
            },
          ],
        },
      },

      /* 2 · แถบข่าวเลื่อน */
      {
        id: 'ticker',
        type: 'SiteTickerComponent',
        props: {
          label: 'ข่าวสารและกิจกรรมล่าสุด',
          items: [
            { label: 'ประกาศรับสมัครบุคคลเพื่อสรรหาเป็นพนักงานจ้าง ประจำปีงบประมาณ 2569', href: '/jobs' },
            { label: 'แจ้งกำหนดการชำระภาษีที่ดินและสิ่งปลูกสร้าง ประจำปี 2569', href: '/news' },
            { label: 'ประกาศเผยแพร่แผนการจัดซื้อจัดจ้าง ประจำปีงบประมาณ พ.ศ. 2569', href: '/procurement' },
            { label: 'โครงการอบรมส่งเสริมอาชีพให้แก่ประชาชน ประจำปี 2569', href: '/activity' },
          ],
        },
      },

      /* 3 · ค้นหาทั้งเว็บไซต์ */
      { id: 'search', type: 'SiteSearchComponent', props: { action: '/news' } },

      /* 4 · ผู้บริหารและวิดีโอแนะนำหน่วยงาน */
      {
        id: 'exec_row',
        type: 'ServiceLinksComponent',
        props: {
          stylePreset: 'gov-band-soft',
          title: 'ผู้บริหารหน่วยงาน',
          subtitle: MOCK_PERSON_NOTE,
          columns: 3,
          items: [
            { label: 'คณะผู้บริหาร', description: 'นายกเทศมนตรีและรองนายกเทศมนตรี', icon: 'people', href: '/personnel' },
            { label: 'สมาชิกสภาเทศบาล', description: 'ฝ่ายนิติบัญญัติของหน่วยงาน', icon: 'agency', href: '/personnel' },
            { label: 'หัวหน้าส่วนราชการ', description: 'ปลัดเทศบาลและผู้อำนวยการกอง', icon: 'office', href: '/personnel' },
          ],
        },
      },

      /* 5 · เมนูหมวดหมู่ พร้อมข่าวประชาสัมพันธ์และข่าวกิจกรรม */
      {
        id: 'home_body',
        type: 'SiteSidebarMenuComponent',
        props: { title: 'เมนูหลัก', items: sidebarItems('/') },
        children: [
          postList('home_news', {
            title: 'ข่าวประชาสัมพันธ์',
            subtitle: 'ประกาศและข่าวสารจากเทศบาล',
            category: 1, page: 'news', columns: 3,
          }),
          postList('home_activity', {
            title: 'ข่าวกิจกรรม',
            subtitle: 'ภาพกิจกรรมและโครงการของหน่วยงาน',
            category: 2, page: 'activity', columns: 3,
          }),
        ],
      },

      /* 5b · ปฏิทินกิจกรรม */
      {
        id: 'calendar',
        type: 'EventCalendarComponent',
        props: {
          title: 'ปฏิทินกิจกรรม',
          subtitle: 'วันที่มีจุดสีคือวันที่มีกิจกรรม กดเพื่อดูรายการ',
          emptyText: 'ยังไม่มีกิจกรรมในเดือนนี้',
          dataSource: {
            table: 'cms_post',
            where: { cms_category_id: 2 },
            orderBy: 'publish_at',
            direction: 'desc',
            limit: 50,
            linkPattern: '/activity/{id}',
          },
        },
      },

      /* 6 · แจ้งเหตุฉุกเฉิน */
      {
        id: 'smart_alert',
        type: 'MediaFeatureComponent',
        props: {
          image: '/img/mock/alert-banner.svg',
          alt: MOCK_ALT,
          mark: 'alert',
          title: 'ระบบแจ้งเหตุและสาธารณภัย',
          subtitle: 'แจ้งเหตุด่วนสาธารณภัยในพื้นที่ ตลอด 24 ชั่วโมง',
          buttonLabel: 'แจ้งเหตุ',
          href: '/contact',
        },
      },

      /* 7 · การประเมินคุณธรรมและความโปร่งใส */
      linkGrid('ita', {
        title: 'การประเมินคุณธรรมและความโปร่งใส (ITA)',
        subtitle: 'ข้อมูลที่หน่วยงานเปิดเผยตามเกณฑ์การประเมิน',
        band: 'formal',
        columns: 4,
        items: [
          { label: 'ข้อมูลพื้นฐานหน่วยงาน', icon: 'agency', href: '/about' },
          { label: 'อำนาจหน้าที่และกฎหมาย', icon: 'law', href: '/authority' },
          { label: 'แผนพัฒนาและแผนปฏิบัติการ', icon: 'documents', href: '/documents' },
          { label: 'รายงานผลการดำเนินงาน', icon: 'documents', href: '/documents' },
          { label: 'แผนและรายงานการใช้จ่ายงบประมาณ', icon: 'budget', href: '/documents' },
          { label: 'การจัดซื้อจัดจ้างและการจัดหาพัสดุ', icon: 'procurement', href: '/procurement' },
          { label: 'การบริหารและพัฒนาทรัพยากรบุคคล', icon: 'people', href: '/documents' },
          { label: 'คู่มือและมาตรฐานการให้บริการ', icon: 'form', href: '/documents' },
        ],
      }),

      /* 8 · ศูนย์บริการประชาชนอิเล็กทรอนิกส์ */
      linkGrid('eservice', {
        title: 'ศูนย์บริการประชาชนอิเล็กทรอนิกส์',
        subtitle: 'ยื่นคำขอ แจ้งเรื่อง และสอบถามข้อมูลออนไลน์',
        band: 'soft',
        columns: 3,
        items: [
          { label: 'ร้องเรียนร้องทุกข์', description: 'แจ้งปัญหาในพื้นที่ถึงเจ้าหน้าที่', icon: 'complaint', href: '/contact' },
          { label: 'แจ้งเรื่องทุจริต', description: 'ช่องทางแจ้งเบาะแสการทุจริต', icon: 'integrity', href: '/contact' },
          { label: 'สอบถามข้อมูล (Q&A)', description: 'คำถามที่พบบ่อยและช่องทางสอบถาม', icon: 'search', href: '/contact' },
        ],
      }),

      /* 9 · ประกาศจัดซื้อจัดจ้าง */
      noticeList('home_procurement', {
        title: 'ประกาศจัดซื้อจัดจ้าง',
        category: 3, page: 'procurement',
        moreLabel: 'ประกาศจัดซื้อจัดจ้างทั้งหมด',
      }),

      /* 10 · ข่าวรับสมัครงาน โอน/ย้าย */
      noticeList('home_jobs', {
        title: 'ข่าวรับสมัครงาน โอน/ย้าย',
        category: 4, page: 'jobs',
        moreLabel: 'ประกาศรับสมัครงานทั้งหมด',
      }),

      /* 11 · ประกาศจัดซื้อจัดจ้างจากระบบ e-GP */
      linkGrid('egp', {
        title: 'ประกาศจัดซื้อจัดจ้างจากระบบ e-GP',
        subtitle: 'ข้อมูลจากระบบจัดซื้อจัดจ้างภาครัฐ กรมบัญชีกลาง',
        band: 'formal',
        columns: 3,
        items: [
          { label: 'ประกาศเชิญชวน', description: 'ประกวดราคาและสอบราคา', icon: 'procurement', href: 'https://process.gprocurement.go.th', external: true },
          { label: 'ประกาศราคากลาง', description: 'ราคากลางและการคำนวณ', icon: 'budget', href: 'https://process.gprocurement.go.th', external: true },
          { label: 'ประกาศผลผู้ชนะ', description: 'ผลการจัดซื้อจัดจ้างรายไตรมาส', icon: 'documents', href: 'https://process.gprocurement.go.th', external: true },
        ],
      }),

      /* 12 · วิดีโอแนะนำหน่วยงาน */
      {
        id: 'intro_video',
        type: 'MediaFeatureComponent',
        props: {
          image: '/img/mock/video-cover.svg',
          alt: MOCK_ALT,
          mark: 'play',
          title: 'วิดีโอแนะนำหน่วยงาน',
          subtitle: 'ยังไม่ได้อัปโหลดวิดีโอจริง',
          buttonLabel: 'ดูวิดีโอ',
          href: '/about',
        },
      },

      /* 13 · แหล่งท่องเที่ยวและสถานที่สำคัญ */
      {
        id: 'tour',
        type: 'GalleryComponent',
        props: {
          title: 'แหล่งท่องเที่ยวและสถานที่สำคัญ',
          columns: 4,
          items: [
            { id: 'tour-1', title: 'วัดประจำตำบล', imageUrl: '/img/mock/tour-1.svg', description: MOCK_ALT },
            { id: 'tour-2', title: 'ตลาดชุมชน', imageUrl: '/img/mock/tour-2.svg', description: MOCK_ALT },
            { id: 'tour-3', title: 'สวนสาธารณะริมคลอง', imageUrl: '/img/mock/tour-3.svg', description: MOCK_ALT },
            { id: 'tour-4', title: 'ศูนย์เรียนรู้ภูมิปัญญาท้องถิ่น', imageUrl: '/img/mock/tour-4.svg', description: MOCK_ALT },
          ],
        },
      },

      /* 14 · แบบฟอร์มและเอกสารดาวน์โหลด */
      linkGrid('forms', {
        title: 'แบบฟอร์มและเอกสารดาวน์โหลด',
        subtitle: 'เอกสารที่ประชาชนใช้บ่อย',
        band: 'soft',
        columns: 4,
        items: [
          { label: 'คำร้องทั่วไป', icon: 'form', href: '/documents' },
          { label: 'คำขออนุญาตก่อสร้างอาคาร', icon: 'form', href: '/documents' },
          { label: 'แบบฟอร์มร้องเรียนร้องทุกข์', icon: 'complaint', href: '/documents' },
          { label: 'คำขอข้อมูลข่าวสารของราชการ', icon: 'download', href: '/documents' },
        ],
      }),

      /* 15 · ลิงก์ที่น่าสนใจ */
      {
        id: 'partners',
        type: 'PartnerStripComponent',
        props: {
          title: 'ลิงก์ที่น่าสนใจ',
          items: [
            { label: 'กรมส่งเสริมการปกครองท้องถิ่น', href: 'https://www.dla.go.th' },
            { label: 'ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)', href: 'https://process.gprocurement.go.th' },
            { label: 'สำนักงาน ป.ป.ช.', href: 'https://www.nacc.go.th' },
            { label: 'ศูนย์รวมข้อมูลเพื่อติดต่อราชการ', href: 'https://www.info.go.th' },
            { label: 'กรมบัญชีกลาง', href: 'https://www.cgd.go.th' },
            { label: 'สำนักงานคณะกรรมการกฤษฎีกา', href: 'https://www.krisdika.go.th' },
          ],
        },
      },

      /* 16 · แผนที่ที่ตั้งสำนักงาน */
      {
        id: 'map',
        type: 'MediaFeatureComponent',
        props: {
          image: '/img/mock/map-banner.svg',
          alt: MOCK_ALT,
          mark: 'map',
          light: true,
          title: 'ที่ตั้งสำนักงาน',
          subtitle: AGENCY.address,
          buttonLabel: 'เปิดแผนที่นำทาง',
          href: 'https://www.google.com/maps',
          external: true,
        },
      },

      /* 17 · ข้อมูลพื้นฐานของตำบล */
      {
        id: 'home_stats',
        type: 'StatCounterComponent',
        props: {
          stylePreset: 'gov-band-formal',
          title: 'ข้อมูลพื้นฐานของตำบล',
          items: [
            { label: 'จำนวนหมู่บ้าน', value: 12, unit: 'หมู่บ้าน', icon: 'area' },
            { label: 'จำนวนครัวเรือน', value: 2480, unit: 'ครัวเรือน', icon: 'offices' },
            { label: 'จำนวนประชากร', value: 7860, unit: 'คน', icon: 'people' },
            { label: 'พื้นที่รับผิดชอบ', value: 48, unit: 'ตร.กม.', icon: 'area' },
          ],
        },
      },

      footer(),
      dock(),
      floatingNotices(),
      cookieBar(),
    ],
  },

  innerPage('news', 'ข่าวประชาสัมพันธ์', {
    title: 'ข่าวประชาสัมพันธ์',
    description: `ประกาศและข่าวสารจาก${AGENCY.name}`,
    priority: 0.8,
    changeFrequency: 'daily',
  }, '/news', [
    postList('news_all', {
      title: 'ข่าวประชาสัมพันธ์',
      subtitle: 'ประกาศและข่าวสารทั้งหมด',
      category: 1,
      page: 'news',
      limit: 6,
      columns: 3,
      more: false,
      paginate: true,
    }),
  ]),

  innerPage('activity', 'ข่าวกิจกรรม', {
    title: 'ข่าวกิจกรรม',
    description: `ภาพกิจกรรมและโครงการของ${AGENCY.name}`,
    priority: 0.8,
    changeFrequency: 'daily',
  }, '/activity', [
    postList('activity_all', {
      title: 'ข่าวกิจกรรม',
      subtitle: 'กิจกรรมและโครงการทั้งหมด',
      category: 2,
      page: 'activity',
      limit: 6,
      columns: 3,
      more: false,
      paginate: true,
    }),
  ]),

  innerPage('procurement', 'ประกาศจัดซื้อจัดจ้าง', {
    title: 'ประกาศจัดซื้อจัดจ้าง',
    description: 'แผนการจัดซื้อจัดจ้าง ราคากลาง และผลการจัดซื้อจัดจ้าง',
    priority: 0.8,
    changeFrequency: 'weekly',
  }, '/procurement', [
    postList('procurement_all', {
      title: 'ประกาศจัดซื้อจัดจ้าง',
      subtitle: 'เปิดเผยตามหลักธรรมาภิบาล',
      category: 3,
      page: 'procurement',
      limit: 6,
      columns: 3,
      more: false,
      paginate: true,
    }),
  ]),

  innerPage('about', 'ข้อมูลทั่วไป', {
    title: 'ข้อมูลทั่วไป',
    description: `ข้อมูลทั่วไปและที่ตั้งของ${AGENCY.name}`,
    priority: 0.6,
    changeFrequency: 'monthly',
  }, '/about', [
    html('about_body',
      `<h2>ข้อมูลทั่วไป</h2><p>${AGENCY.name} ตั้งอยู่ที่ ${AGENCY.address} `
      + 'มีพื้นที่รับผิดชอบ 48 ตารางกิโลเมตร ครอบคลุม 12 หมู่บ้าน '
      + 'ประชากรรวมประมาณ 7,860 คน จำนวน 2,480 ครัวเรือน</p>'
      + '<h2>ลักษณะภูมิประเทศ</h2><p>พื้นที่ส่วนใหญ่เป็นที่ราบลุ่ม เหมาะแก่การเกษตรกรรม '
      + 'ประชากรส่วนใหญ่ประกอบอาชีพทำนา ทำไร่ และรับจ้างทั่วไป</p>'),
  ]),

  innerPage('vision', 'วิสัยทัศน์และพันธกิจ', {
    title: 'วิสัยทัศน์และพันธกิจ',
    description: `วิสัยทัศน์และพันธกิจของ${AGENCY.name}`,
    priority: 0.6,
    changeFrequency: 'yearly',
  }, '/vision', [
    html('vision_body', CMS_PAGES[0].description),
  ]),

  innerPage('authority', 'อำนาจหน้าที่', {
    title: 'อำนาจหน้าที่',
    description: `อำนาจหน้าที่ตามกฎหมายของ${AGENCY.name}`,
    priority: 0.6,
    changeFrequency: 'yearly',
  }, '/authority', [
    html('authority_body', CMS_PAGES[1].description),
  ]),

  innerPage('structure', 'โครงสร้างหน่วยงาน', {
    title: 'โครงสร้างหน่วยงาน',
    description: `โครงสร้างการแบ่งส่วนราชการของ${AGENCY.name}`,
    priority: 0.6,
    changeFrequency: 'yearly',
  }, '/structure', [
    html('structure_body',
      '<h2>การแบ่งส่วนราชการ</h2><ul>'
      + '<li>สำนักปลัดเทศบาล</li>'
      + '<li>กองคลัง</li>'
      + '<li>กองช่าง</li>'
      + '<li>กองการศึกษา ศาสนา และวัฒนธรรม</li>'
      + '<li>กองสาธารณสุขและสิ่งแวดล้อม</li>'
      + '</ul>'
      + '<p>แต่ละส่วนราชการมีหัวหน้าส่วนราชการรับผิดชอบ '
      + 'ภายใต้การกำกับดูแลของปลัดเทศบาลและนายกเทศมนตรี</p>'),
  ]),

  innerPage('personnel', 'บุคลากร', {
    title: 'คณะผู้บริหารและบุคลากร',
    description: `คณะผู้บริหารและบุคลากรของ${AGENCY.name}`,
    priority: 0.6,
    changeFrequency: 'monthly',
  }, '/personnel', [
    {
      id: 'personnel_exec',
      type: 'PeopleGridComponent',
      props: {
        title: 'คณะผู้บริหาร',
        subtitle: 'ยังไม่ได้อัปโหลดภาพถ่าย — ภาพของผู้บริหารต้องเป็นภาพถ่ายจริงเท่านั้น',
        columns: 4,
        items: [
          { name: 'ตำแหน่งว่าง', position: 'นายกเทศมนตรี' },
          { name: 'ตำแหน่งว่าง', position: 'รองนายกเทศมนตรี' },
          { name: 'ตำแหน่งว่าง', position: 'ปลัดเทศบาล' },
          { name: 'ตำแหน่งว่าง', position: 'รองปลัดเทศบาล' },
        ],
      },
    },
  ]),

  innerPage('documents', 'เอกสารเผยแพร่', {
    title: 'เอกสารเผยแพร่',
    description: 'แผนพัฒนา รายงานผลการดำเนินงาน งบประมาณ และคู่มือการปฏิบัติงาน',
    priority: 0.7,
    changeFrequency: 'monthly',
  }, '/documents', [
    html('documents_body',
      '<h2>แผนพัฒนาและแผนปฏิบัติการ</h2>'
      + '<p>แผนพัฒนาท้องถิ่น แผนดำเนินงานประจำปี และแผนอัตรากำลัง '
      + 'เผยแพร่เพื่อให้ประชาชนตรวจสอบได้</p>'
      + '<h2>รายงานผลการดำเนินงาน</h2>'
      + '<p>รายงานผลการดำเนินงานรายไตรมาสและประจำปี พร้อมผลการใช้จ่ายงบประมาณ</p>'
      + '<h2>คู่มือและมาตรฐานการให้บริการ</h2>'
      + '<p>คู่มือสำหรับประชาชนตามพระราชบัญญัติการอำนวยความสะดวกฯ พ.ศ. 2558 '
      + 'ระบุขั้นตอน ระยะเวลา และเอกสารที่ต้องใช้ของแต่ละงานบริการ</p>'
      + '<p class="text-muted"><em>ยังไม่ได้อัปโหลดไฟล์เอกสาร — '
      + 'เมื่ออัปโหลดแล้วรายการจะแสดงที่นี่</em></p>'),
  ]),

  innerPage('jobs', 'ข่าวรับสมัครงาน โอน/ย้าย', {
    title: 'ข่าวรับสมัครงาน โอน/ย้าย',
    description: `ประกาศรับสมัครงาน รับโอน และย้ายของ${AGENCY.name}`,
    priority: 0.7,
    changeFrequency: 'weekly',
  }, '/jobs', [
    postList('jobs_all', {
      title: 'ข่าวรับสมัครงาน โอน/ย้าย',
      subtitle: 'ประกาศทั้งหมด',
      category: 4, page: 'jobs', limit: 24, columns: 2, more: false,
    }),
  ]),

  innerPage('privacy', 'นโยบายความเป็นส่วนตัว', {
    title: 'นโยบายความเป็นส่วนตัว',
    description: 'นโยบายการคุ้มครองข้อมูลส่วนบุคคลและการใช้คุกกี้ของเว็บไซต์',
    priority: 0.4,
    changeFrequency: 'yearly',
  }, '/privacy', [
    html('privacy_body',
      '<h2>การใช้คุกกี้</h2>'
      + '<p>เว็บไซต์นี้ใช้คุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์เท่านั้น เช่น '
      + 'การจดจำสถานะการเข้าสู่ระบบและขนาดตัวอักษรที่ท่านเลือก '
      + 'คุกกี้เหล่านี้ไม่ได้ใช้ติดตามพฤติกรรมของท่านเพื่อการโฆษณา</p>'
      + '<h2>ข้อมูลส่วนบุคคล</h2>'
      + '<p>หน่วยงานเก็บรวบรวมข้อมูลส่วนบุคคลเท่าที่จำเป็นต่อการให้บริการ '
      + 'ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 '
      + 'และจะไม่เปิดเผยต่อบุคคลภายนอกโดยไม่ได้รับความยินยอม '
      + 'เว้นแต่เป็นการปฏิบัติตามที่กฎหมายกำหนด</p>'
      + '<h2>สิทธิของเจ้าของข้อมูล</h2>'
      + '<p>ท่านมีสิทธิขอเข้าถึง ขอแก้ไข ขอลบ และขอคัดค้านการประมวลผลข้อมูลส่วนบุคคลของท่าน '
      + `โดยติดต่อได้ที่ ${AGENCY.email} หรือโทร ${AGENCY.phone}</p>`),
  ]),

  innerPage('services', 'บริการประชาชน', {
    title: 'บริการประชาชน',
    description: 'บริการออนไลน์และแบบฟอร์มสำหรับประชาชน',
    priority: 0.8,
    changeFrequency: 'monthly',
  }, '/services', [
    {
      id: 'services_all',
      type: 'ServiceLinksComponent',
      props: {
        title: 'บริการออนไลน์',
        subtitle: 'เลือกบริการที่ต้องการติดต่อ',
        columns: 3,
        items: [
          { label: 'แจ้งเรื่องร้องเรียน / ร้องทุกข์', description: 'แจ้งปัญหาในพื้นที่ถึงเจ้าหน้าที่', icon: 'complaint', href: '/contact' },
          { label: 'ชำระภาษีที่ดินและสิ่งปลูกสร้าง', description: 'ตรวจสอบยอดและช่องทางชำระ', icon: 'budget', href: '/contact' },
          { label: 'ขออนุญาตก่อสร้างอาคาร', description: 'ยื่นคำขอและตรวจสอบสถานะ', icon: 'form', href: '/contact' },
          { label: 'ดาวน์โหลดแบบฟอร์ม', description: 'แบบฟอร์มราชการที่ใช้บ่อย', icon: 'download', href: '/contact' },
          { label: 'ประกาศจัดซื้อจัดจ้าง', description: 'แผน ราคากลาง และผลการจัดซื้อ', icon: 'procurement', href: '/procurement' },
          { label: 'ข้อมูลผู้บริหารและบุคลากร', description: 'ติดต่อเจ้าหน้าที่แต่ละส่วนราชการ', icon: 'people', href: '/personnel' },
        ],
      },
    },
  ]),

  innerPage('contact', 'ติดต่อเรา', {
    title: 'ติดต่อเรา',
    description: `ที่อยู่ เบอร์โทรศัพท์ และเวลาทำการของ${AGENCY.name}`,
    priority: 0.7,
    changeFrequency: 'yearly',
  }, '/contact', [
    html('contact_body',
      `<h2>ที่อยู่</h2><p>${AGENCY.address}</p>`
      + `<h2>ช่องทางติดต่อ</h2><ul>`
      + `<li>โทรศัพท์ ${AGENCY.phone}</li>`
      + `<li>โทรสาร ${AGENCY.fax}</li>`
      + `<li>อีเมล ${AGENCY.email}</li>`
      + '</ul>'
      + `<h2>เวลาทำการ</h2><p>${AGENCY.officeHours}</p>`),
  ]),
];

/* ------------------------------------------------------------------ seeding */

async function seedTenantContent(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.cms_category (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(500), description TEXT, status INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_post (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      cms_category_id BIGINT, name VARCHAR(500), description TEXT, image TEXT,
      status INT DEFAULT 1, publish_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.cms_page (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(500), description TEXT, slug VARCHAR(255),
      status INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  for (const category of CATEGORIES) {
    await client.query(
      `INSERT INTO public.cms_category (id, name, status) VALUES ($1, $2, 1)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [category.id, category.name],
    );
  }
  // Identity sequences do not advance when ids are supplied explicitly.
  await client.query(
    "SELECT setval(pg_get_serial_sequence('public.cms_category','id'), GREATEST((SELECT MAX(id) FROM public.cms_category), 1))",
  );

  let added = 0;
  for (const post of [...POSTS, ...FILLER]) {
    const exists = await client.query('SELECT 1 FROM public.cms_post WHERE name = $1', [post.name]);
    if (exists.rowCount) continue;
    await client.query(
      `INSERT INTO public.cms_post (cms_category_id, name, description, status, publish_at)
       VALUES ($1, $2, $3, 1, NOW() - ($4 || ' days')::interval)`,
      [post.category, post.name, post.description, post.days],
    );
    added += 1;
  }

  let pages = 0;
  for (const page of CMS_PAGES) {
    const exists = await client.query('SELECT 1 FROM public.cms_page WHERE slug = $1', [page.slug]);
    if (exists.rowCount) continue;
    await client.query(
      'INSERT INTO public.cms_page (name, description, slug, status) VALUES ($1, $2, $3, 1)',
      [page.name, page.description, page.slug],
    );
    pages += 1;
  }

  // Articles seeded before illustrations existed still have none, which leaves
  // half the grid as placeholder plates. Fill only the empty ones.
  await client.query(`
    UPDATE public.cms_post
    SET image = '/img/mock/news-' || ((id % 6) + 1) || '.svg'
    WHERE image IS NULL OR image = ''
  `);

  const counts = await client.query(
    'SELECT (SELECT COUNT(*) FROM public.cms_post) AS posts, (SELECT COUNT(*) FROM public.cms_page) AS pages',
  );
  return {
    postsAdded: added,
    pagesAdded: pages,
    postsTotal: Number(counts.rows[0].posts),
    pagesTotal: Number(counts.rows[0].pages),
  };
}

async function main() {
  const core = new Client({ connectionString: CORE_URL });
  await core.connect();

  const platform = await core.query(
    'SELECT id, platform_slug, public_data_access FROM public.platforms WHERE platform_slug = $1',
    [PLATFORM_SLUG],
  );
  if (!platform.rowCount) {
    throw new Error(`ไม่พบ platform '${PLATFORM_SLUG}' ในฐานข้อมูล`);
  }
  const { id: platformId, public_data_access: access } = platform.rows[0];

  // The listings and the article page read these tables without a session, so
  // they must be on the public allow-list or every section renders empty.
  const readable = new Set([...(access?.readable ?? []), 'cms_post', 'cms_category', 'cms_page']);
  await core.query(
    `UPDATE public.platforms
     SET public_data_access = jsonb_set(COALESCE(public_data_access, '{}'::jsonb), '{readable}', $2::jsonb)
     WHERE id = $1`,
    [platformId, JSON.stringify([...readable])],
  );

  const snapshot = await core.query(
    'SELECT COALESCE(runtime_snapshot, \'{}\'::jsonb) AS snapshot FROM public.platforms WHERE id = $1',
    [platformId],
  );
  const next = { ...snapshot.rows[0].snapshot, pages: PAGES };
  await core.query('UPDATE public.platforms SET runtime_snapshot = $2::jsonb WHERE id = $1', [
    platformId,
    JSON.stringify(next),
  ]);

  const tenantDb = `platform_${PLATFORM_SLUG.replace(/-/g, '_')}`;
  const tenantUrl = CORE_URL.replace(/\/[^/]+$/, `/${tenantDb}`);
  const tenant = new Client({ connectionString: tenantUrl });
  await tenant.connect();
  const content = await seedTenantContent(tenant);
  await tenant.end();

  // Every site of this platform serves the new structure on its next request.
  const sites = await core.query(
    'SELECT app_slug FROM public.apps WHERE platform_id = $1 ORDER BY app_slug',
    [platformId],
  );
  await core.end();

  console.log(`platform  : ${PLATFORM_SLUG}`);
  console.log(`หน้าเว็บ   : ${PAGES.length} หน้า`);
  console.log(`บทความ    : เพิ่มใหม่ ${content.postsAdded} รายการ (รวม ${content.postsTotal})`);
  console.log(`หน้าเนื้อหา: เพิ่มใหม่ ${content.pagesAdded} รายการ (รวม ${content.pagesTotal})`);
  console.log(`เว็บไซต์ที่ได้รับผล: ${sites.rows.map((row) => row.app_slug).join(', ') || '(ยังไม่มี)'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
