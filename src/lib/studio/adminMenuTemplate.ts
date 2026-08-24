import type { ComponentNode } from '@/types';
import type { SlideMenuItem } from '@/components/shared/SlideMenuComponent';

const TABLE_COLLECTIONS: Record<string, string> = {
  cms_post: 'cms.post.collection',
  cms_category: 'cms.category.collection',
  cms_page: 'cms.page.collection',
  cms_personnel: 'cms.personnel.collection',
  cms_personnel_group: 'cms.personnel-group.collection',
  cms_slide: 'cms.slide.collection',
  cms_banner_slide: 'cms.banner-slide.collection',
  cms_file: 'cms.file.collection',
  cms_file_category: 'cms.file-category.collection',
  menu: 'cms.menu.collection',
  menu_group: 'cms.menu-group.collection',
  ebook: 'cms.ebook.collection',
  ebook_category: 'cms.ebook-category.collection',
  cms_homepage_highlight: 'cms.homepage-highlight.collection',
  cms_contact_channel: 'cms.contact-channel.collection',
  cms_grayscale: 'cms.grayscale.collection',
  cms_compliant: 'cms.complaint.collection',
  complaint: 'cms.complaint.collection',
  cms_corrupt: 'cms.corrupt.collection',
  corrupt: 'cms.corrupt.collection',
  cms_personalreport: 'cms.personalreport.collection',
  personalreport: 'cms.personalreport.collection',
  cms_generalhelp: 'cms.generalhelp.collection',
  generalhelp: 'cms.generalhelp.collection',
  cms_oldage: 'cms.oldage.collection',
  oldage: 'cms.oldage.collection',
  cms_usewater: 'cms.usewater.collection',
  usewater: 'cms.usewater.collection',
  cms_electric: 'cms.electric.collection',
  electric: 'cms.electric.collection',
  cms_getbin: 'cms.getbin.collection',
  getbin: 'cms.getbin.collection',
  cms_handicapped: 'cms.handicapped.collection',
  handicapped: 'cms.handicapped.collection',
  cms_onlinequeue: 'cms.onlinequeue.collection',
  onlinequeue: 'cms.onlinequeue.collection',
  cms_tag: 'cms.tag.collection',
  smartreport_ticket: 'smartreport.ticket.collection',
  report_ticket: 'smartreport.ticket.collection',
  smartreport_category: 'smartreport.category.collection',
  report_category: 'smartreport.category.collection',
  smartreport_urgency: 'smartreport.urgency.collection',
  report_urgency: 'smartreport.urgency.collection',
  smartreport_status: 'smartreport.status.collection',
  report_status: 'smartreport.status.collection',
  booking_service: 'booking.service.collection',
  booking_queue: 'booking.queue.collection',
  forum_thread: 'forum.thread.collection',
  forum_category: 'forum.category.collection',
  forum_comment: 'forum.comment.collection',
  cms_menu: 'administrator.cms-menu.collection',
  user: 'administrator.user.collection',
  auth_assignment: 'administrator.rbac-assignment.collection',
  auth_item: 'administrator.rbac-role.collection',
};

const preferredView = (table?: string): 'DataTableComponent' | 'ListComponent' | 'GalleryComponent' =>
  ['cms_category', 'cms_personnel_group', 'cms_file_category', 'menu', 'menu_group', 'ebook_category', 'smartreport_category', 'report_category', 'smartreport_urgency', 'report_urgency', 'smartreport_status', 'report_status', 'booking_service', 'forum_category', 'cms_menu', 'cms_tag'].includes(table || '')
    ? 'ListComponent'
    : ['cms_personnel', 'cms_slide', 'cms_banner_slide', 'ebook'].includes(table || '')
    ? 'GalleryComponent'
    : 'DataTableComponent';

const child = (id: string, label: string, route: string, table?: string, kind: 'form' | 'datatable' | 'collection' | 'dashboard' = 'datatable', collectionOverride?: string): SlideMenuItem => {
  const collectionId = collectionOverride || (table ? TABLE_COLLECTIONS[table] : undefined);
  const componentType = kind === 'form' ? 'FormComponent' : preferredView(table);
  const viewSuffix = componentType === 'DataTableComponent' ? 'datatable' : componentType === 'ListComponent' ? 'list' : componentType === 'GalleryComponent' ? 'gallery' : undefined;
  return {
    id, label, href: route, resource: { kind, route, ...(table ? { table } : {}), componentType, ...(collectionId ? { collectionId } : {}), ...(kind === 'form' && collectionId ? { formId: `${collectionId.replace(/\.collection$/, '')}.form`, params: { mode: 'insert' } } : viewSuffix && collectionId ? { componentId: `${collectionId}.${viewSuffix}`, params: { mode: 'list', limit: 20, offset: 0 } } : {}) },
  };
};

const group = (id: string, label: string, permission: string, children: SlideMenuItem[]): SlideMenuItem => ({ id, label, permission, children });
const section = (id: string, label: string): SlideMenuItem => ({ id, label, type: 'section' });

export const ADMIN_SIDEBAR_ITEMS: SlideMenuItem[] = [
  section('section-overview', 'ภาพรวม'),
  { id: 'dashboard', label: 'แผงควบคุม', href: '/site/index', active: true, resource: { kind: 'dashboard', route: '/site/index' } },

  section('section-cms', 'จัดการเนื้อหาเว็บไซต์'),
  group('cms-post', 'ข่าวสาร/เนื้อหา', 'cms', [child('post-index', 'รายการข่าวสาร', '/cms/post/index', 'cms_post'), child('post-create', 'เพิ่มข่าวสาร', '/cms/post/create', 'cms_post', 'form'), child('category-index', 'รายการหมวดหมู่', '/cms/category/index', 'cms_category'), child('category-create', 'เพิ่มหมวดหมู่', '/cms/category/create', 'cms_category', 'form')]),
  group('cms-page', 'หน้าเว็บไซต์', 'cms', [child('page-index', 'รายการหน้าเว็บ', '/cms/page/index', 'cms_page'), child('page-create', 'เพิ่มหน้าเว็บ', '/cms/page/create', 'cms_page', 'form')]),
  group('cms-highlight', 'จัดการรูปนายกและปลัด', 'cms', [child('highlight-index', 'รูปนายกและปลัด', '/cms/homepage-highlight/index', 'cms_homepage_highlight', 'collection')]),
  group('cms-contact', 'ช่องทางติดต่อ', 'cms', [child('contact-index', 'ช่องทางติดต่อ', '/cms/contact-channel/index', 'cms_contact_channel', 'collection')]),
  group('cms-personnel', 'โครงสร้างบุคลากร', 'cms', [child('personnel-index', 'รายการบุคลากร', '/cms/personnel/index', 'cms_personnel'), child('personnel-create', 'เพิ่มบุคลากร', '/cms/personnel/create', 'cms_personnel', 'form'), child('personnel-group-index', 'รายการกลุ่มบุคลากร', '/cms/personnel-group/index', 'cms_personnel_group'), child('personnel-group-create', 'เพิ่มกลุ่มบุคลากร', '/cms/personnel-group/create', 'cms_personnel_group', 'form')]),
  group('cms-slide', 'ภาพสไลด์', 'cms', [child('slide-index', 'รายการสไลด์', '/cms/slide/index', 'cms_slide', 'collection'), child('slide-create', 'เพิ่มสไลด์', '/cms/slide/create', 'cms_slide', 'form')]),
  group('cms-banner', 'Banner Slideshow', 'cms', [child('banner-index', 'รายการ Banner', '/cms/banner-slide/index', 'cms_banner_slide', 'collection'), child('banner-create', 'เพิ่ม Banner', '/cms/banner-slide/create', 'cms_banner_slide', 'form')]),
  group('cms-ebook', 'E-Book', 'cms', [child('ebook-index', 'หนังสือ E-Book', '/ebook/ebook/index', 'ebook'), child('ebook-category-index', 'หมวดหมู่ E-Book', '/ebook/ebook-category/index', 'ebook_category')]),
  group('cms-file', 'ไฟล์ดาวน์โหลด', 'cms', [child('file-index', 'รายการไฟล์', '/cms/file/index', 'cms_file'), child('file-category-index', 'หมวดหมู่ไฟล์', '/cms/file-category/index', 'cms_file_category')]),
  group('cms-complaint', 'ร้องเรียน/ทุจริต', 'cms', [child('complaint-index', 'ร้องเรียนร้องทุกข์', '/cms/compliant/index', 'cms_compliant'), child('corrupt-index', 'ร้องเรียนทุจริต', '/cms/corrupt/index', 'cms_corrupt')]),
  group('cms-service', 'บริการประชาชน', 'cms', [child('personalreport-index', 'ร้องเรียนบุคลากร', '/cms/personalreport/index', 'cms_personalreport'), child('generalhelp-index', 'ขอความช่วยเหลือ', '/cms/generalhelp/index', 'cms_generalhelp'), child('oldage-index', 'เบี้ยยังชีพผู้สูงอายุ', '/cms/oldage/index', 'cms_oldage'), child('usewater-index', 'ขอน้ำเพื่อบริโภค', '/cms/usewater/index', 'cms_usewater'), child('electric-index', 'ซ่อมไฟฟ้า/สาธารณะ', '/cms/electric/index', 'cms_electric'), child('getbin-index', 'ขอรับบริการถังขยะ', '/cms/getbin/index', 'cms_getbin'), child('handicapped-index', 'ทะเบียนเบี้ยพิการ', '/cms/handicapped/index', 'cms_handicapped'), child('onlinequeue-index', 'คิวออนไลน์', '/cms/onlinequeue/index', 'cms_onlinequeue')]),
  group('cms-tag', 'แท็กเนื้อหา', 'cms', [child('tag-index', 'รายการแท็ก', '/cms/tag/index', 'cms_tag')]),
  group('cms-menu', 'เมนูเว็บไซต์', 'cms', [child('menu-group-index', 'กลุ่มเมนู', '/cms/menu-group/index', 'menu_group'), child('menu-index', 'เมนู', '/cms/menu/index', 'menu')]),
  group('cms-grayscale', 'โหมดสีเทาหน้าเว็บ', 'cms', [child('grayscale-index', 'จัดการโหมดสีเทา', '/cms/grayscale/index', 'cms_grayscale', 'form')]),

  section('section-smartreport', 'ระบบแจ้งเหตุอัจฉริยะ'),
  { id: 'smartreport-executive', label: 'ภาพรวมสำหรับผู้บริหาร', href: '/smartreport/default/executive', permission: 'smartreport', resource: { kind: 'dashboard', route: '/smartreport/default/executive' } },
  { id: 'smartreport-monitoring', label: 'ติดตามเคสใหม่', href: '/smartreport/ticket/monitoring', permission: 'smartreport', resource: { kind: 'dashboard', route: '/smartreport/ticket/monitoring' } },
  { ...child('smartreport-console', 'แผงควบคุมการรับแจ้ง', '/smartreport/ticket/index', 'smartreport_ticket'), permission: 'smartreport' },
  group('smartreport-ticket', 'รายการแจ้งเหตุ', 'smartreport', [child('ticket-all', 'รายการทั้งหมด', '/smartreport/ticket/index', 'smartreport_ticket'), child('ticket-map', 'แผนที่เกิดเหตุ', '/smartreport/default/map', 'smartreport_ticket', 'collection'), child('ticket-waiting', 'รอรับเรื่อง', '/smartreport/ticket/index?status_id=1', 'smartreport_ticket'), child('ticket-progress', 'กำลังดำเนินการ', '/smartreport/ticket/index?status_id=3', 'smartreport_ticket'), child('ticket-report', 'รายงานการแจ้งเหตุ', '/smartreport/ticket/report', 'smartreport_ticket')]),
  group('smartreport-setting', 'ตั้งค่าระบบแจ้งเหตุ', 'smartreport', [child('report-category', 'หมวดหมู่การแจ้ง', '/smartreport/category/index', 'smartreport_category'), child('report-urgency', 'ระดับความเร่งด่วน', '/smartreport/urgency/index', 'smartreport_urgency'), child('report-status', 'สถานะงาน', '/smartreport/status/index', 'smartreport_status')]),

  section('section-booking', 'ระบบจองคิวออนไลน์'),
  { ...child('booking-index', 'ระบบจองคิวออนไลน์', '/booking/default/index', 'booking_queue'), permission: 'queue' },
  { ...child('booking-service', 'ตั้งค่าบริการ', '/booking/service/index', 'booking_service'), permission: 'queue' },

  section('section-forum', 'ระบบกระดานข่าว'),
  group('forum', 'กระทู้', 'forum', [child('forum-thread', 'รายการกระทู้', '/forum/thread/index', 'forum_thread'), child('forum-category', 'กระดานกระทู้', '/forum/category/index', 'forum_category'), child('forum-comment', 'รายการคอมเมนต์', '/forum/comment/index', 'forum_comment')]),

  section('section-administrator', 'ผู้ดูแลระบบ'),
  group('admin-menu', 'จัดการเมนูเว็บไซต์', 'administrator', [child('admin-menu-index', 'รายการเมนู', '/administrator/cms-menu/index', 'cms_menu'), child('admin-menu-create', 'เพิ่มเมนูใหม่', '/administrator/cms-menu/create', 'cms_menu', 'form')]),
  group('admin-user', 'ผู้ใช้งาน', 'administrator', [child('admin-user-index', 'รายการผู้ใช้', '/administrator/user/index', 'user'), child('admin-user-create', 'เพิ่มผู้ใช้', '/administrator/user/create', 'user', 'form')]),
  group('admin-rbac', 'สิทธิ์การเข้าถึง', 'administrator', [child('rbac-assignment', 'การกำหนด', '/admin/assignment/index', 'auth_assignment'), child('rbac-role', 'บทบาท', '/admin/role/index', 'auth_item', 'datatable', 'administrator.rbac-role.collection'), child('rbac-permission', 'สิทธิ์', '/admin/permission/index', 'auth_item', 'datatable', 'administrator.rbac-permission.collection'), child('rbac-route', 'เส้นทาง', '/admin/route/index', 'auth_item', 'datatable', 'administrator.rbac-route.collection')]),
  group('admin-sms', 'SMS', 'administrator', [{ ...child('sms-index', 'ส่ง SMS', '/administrator/sms/index', undefined, 'form'), resource: { kind: 'form', route: '/administrator/sms/index', componentType: 'FormComponent', formId: 'administrator.sms.form', params: { mode: 'insert' } } }]),
];

export const createAdminPageTemplate = (appName: string): ComponentNode[] => {
  const now = Date.now();
  return [
    { id: `admin_sidebar_${now}`, type: 'SlideMenuComponent', props: { __sectionId: 'admin-sidebar', __sectionName: '01. Admin Sidebar Navigation', title: `${appName} · Backend`, items: ADMIN_SIDEBAR_ITEMS, dataSource: { source: 'cms_menu', root: 'backend', fallback: 'design.items' }, authorization: { strategy: 'rbac', permissionField: 'permission' } } },
    { id: `admin_workspace_${now}`, type: 'DynamicHtmlComponent', props: { __sectionId: 'admin-workspace', __sectionName: '02. Admin Content Workspace', componentRole: 'BackendRouteOutlet', content: '<section class="p-4"><h1>แผงควบคุม</h1><p>เลือกเมนูด้านซ้ายเพื่อเปิด Form, DataTable หรือ Collection ตามสิทธิ์ของผู้ใช้งาน</p></section>' } },
  ];
};
