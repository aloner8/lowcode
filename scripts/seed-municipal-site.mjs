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
];

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
  { label: 'หน้าหลัก', href: '/' },
  {
    label: 'เกี่ยวกับหน่วยงาน',
    children: [
      { label: 'ข้อมูลทั่วไป', href: '/about' },
      { label: 'วิสัยทัศน์และพันธกิจ', href: '/vision' },
      { label: 'อำนาจหน้าที่', href: '/authority' },
      { label: 'โครงสร้างหน่วยงาน', href: '/structure' },
    ],
  },
  {
    label: 'บุคลากร',
    children: [
      { label: 'คณะผู้บริหาร', href: '/personnel' },
      { label: 'สมาชิกสภาเทศบาล', href: '/personnel' },
    ],
  },
  {
    label: 'ข่าวสาร',
    children: [
      { label: 'ข่าวประชาสัมพันธ์', href: '/news' },
      { label: 'ข่าวกิจกรรม', href: '/activity' },
      { label: 'ประกาศจัดซื้อจัดจ้าง', href: '/procurement' },
    ],
  },
  { label: 'บริการประชาชน', href: '/services' },
  { label: 'ติดต่อเรา', href: '/contact' },
];

const sidebarItems = (activeHref) => {
  const mark = (item) => ({
    ...item,
    ...(item.href === activeHref ? { active: true } : {}),
    ...(item.children ? { children: item.children.map(mark) } : {}),
  });
  return nav.filter((item) => item.href !== '/').map(mark);
};

const topbar = () => ({
  id: 'topbar',
  type: 'SiteTopbarComponent',
  props: { __chrome: true, phone: AGENCY.phone, email: AGENCY.email },
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

/**
 * A listing. `more` is off on the page that already shows everything — a
 * "see all" button that links to the page you are on is just a dead control.
 */
const postList = (id, { title, subtitle, category, page, limit = 3, columns = 3, more = true }) => ({
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
  ],
});

const PAGES = [
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
      {
        id: 'hero',
        type: 'HeroCarouselComponent',
        props: {
          interval: 7,
          slides: [
            {
              title: AGENCY.name,
              text: 'บริการด้วยความโปร่งใส เป็นธรรม และทันสมัย เพื่อคุณภาพชีวิตที่ดีของประชาชนในพื้นที่',
            },
            {
              title: 'แจ้งเรื่องร้องเรียนออนไลน์',
              text: 'แจ้งปัญหาในพื้นที่ถึงเจ้าหน้าที่ได้ตลอด 24 ชั่วโมง ติดตามสถานะได้ด้วยตนเอง',
              href: '/services',
            },
            {
              title: 'ประกาศจัดซื้อจัดจ้าง',
              text: 'เปิดเผยแผนและผลการจัดซื้อจัดจ้างตามหลักธรรมาภิบาล',
              href: '/procurement',
            },
          ],
        },
      },
      {
        id: 'services',
        type: 'ServiceLinksComponent',
        props: {
          title: 'บริการประชาชน',
          subtitle: 'เรื่องที่ติดต่อบ่อย เข้าถึงได้ในคลิกเดียว',
          columns: 6,
          items: [
            { label: 'แจ้งเรื่องร้องเรียน', icon: 'complaint', href: '/services' },
            { label: 'ชำระภาษีออนไลน์', icon: 'budget', href: '/services' },
            { label: 'ขออนุญาตก่อสร้าง', icon: 'form', href: '/services' },
            { label: 'ดาวน์โหลดแบบฟอร์ม', icon: 'download', href: '/services' },
            { label: 'จัดซื้อจัดจ้าง', icon: 'procurement', href: '/procurement' },
            { label: 'ติดต่อหน่วยงาน', icon: 'contact', href: '/contact' },
          ],
        },
      },
      postList('home_news', {
        title: 'ข่าวประชาสัมพันธ์',
        subtitle: 'ประกาศและข่าวสารจากเทศบาล',
        category: 1,
        page: 'news',
      }),
      postList('home_activity', {
        title: 'ข่าวกิจกรรม',
        subtitle: 'ภาพกิจกรรมและโครงการของหน่วยงาน',
        category: 2,
        page: 'activity',
      }),
      postList('home_procurement', {
        title: 'ประกาศจัดซื้อจัดจ้าง',
        subtitle: 'แผน ราคากลาง และผลการจัดซื้อจัดจ้าง',
        category: 3,
        page: 'procurement',
      }),
      {
        id: 'home_stats',
        type: 'StatCounterComponent',
        props: {
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
      limit: 24,
      columns: 2,
      more: false,
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
      limit: 24,
      columns: 2,
      more: false,
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
      limit: 24,
      columns: 2,
      more: false,
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
  for (const post of POSTS) {
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
