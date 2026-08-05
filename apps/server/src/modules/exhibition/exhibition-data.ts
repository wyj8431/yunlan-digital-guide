import type { ExhibitionCatalog, ExhibitionItem, ExhibitionZone } from './exhibition.types.js';

const zones: ExhibitionZone[] = [
  {
    id: 'entrance',
    name: '乌镇入口前厅',
    description: '从乌镇航拍、导览查询和数字人迎宾开始建立游览方向。',
    order: 1
  },
  {
    id: 'wuzhen',
    name: '乌镇水乡总览',
    description: '从航拍、街巷和乌篷船认识乌镇整体空间与游览关系。',
    order: 2
  },
  {
    id: 'global',
    name: '东栅生活街区',
    description: '了解东栅老街、民居、染坊、水上集市和清晨慢行路线。',
    order: 3
  },
  {
    id: 'avatar-control',
    name: '西栅夜游与场馆',
    description: '查看西栅老街、木心美术馆、乌镇大剧院和夜游信息。',
    order: 4
  },
  {
    id: 'interactive',
    name: '路线与沉浸体验',
    description: '规划东西栅、亲子和夜游路线，并由数字人提供分段讲解。',
    order: 5
  },
  {
    id: 'supporting',
    name: '水巷餐饮与文创',
    description: '集中查看乌镇交通、餐饮、伴手礼和行程带走服务。',
    order: 6
  },
  {
    id: 'culture',
    name: '木心与非遗文化',
    description: '了解木心美术馆、蓝印花布、杭扇和水乡民俗。',
    order: 7
  },
  {
    id: 'digital-guide',
    name: '数字导游互动中心',
    description: '体验乌镇数字导游问答、语音讲解和多语种导览。',
    order: 8
  }
];

function item(
  id: string,
  zoneId: string,
  name: string,
  displayForm: string,
  functionDescription: string,
  backendTables: string,
  coreFields: string,
  priority: ExhibitionItem['priority'],
  interaction: ExhibitionItem['interaction'] = 'detail'
): ExhibitionItem {
  return {
    id,
    zoneId,
    name,
    displayForm,
    functionDescription,
    backendTables: backendTables.split(',').map((value) => value.trim()),
    coreFields: coreFields.split(',').map((value) => value.trim()),
    priority,
    implemented: true,
    interaction
  };
}

const items: ExhibitionItem[] = [
  item('entrance-hologram', 'entrance', '主全息大屏', '悬浮弧形巨幕（双屏拼接）', '左侧展示乌镇水乡影像，右侧展示东栅、西栅与非遗展馆点位；点击点位查看路线和讲解。', 'wuzhen_spots, routes, attractions', 'spot_id, name, zone, route_count, cover_image', 'P0', 'scene'),
  item('welcome-avatar', 'entrance', '迎宾数字人站台', '全息投影站立式数字人', '进门自动触发语音问候，支持语音指令查询路线，联动后端调取路线数据。', 'digital_avatar, voice_commands, routes', 'avatar_id, greeting_text, command_keywords, route_query_api', 'P0', 'guide'),
  item('route-query-console', 'entrance', '导览触控查询台', '立式触控终端（2-4台）', '手动筛选出行天数、预算、主题、人群，筛选结果同步投射到3D空间墙面。', 'routes, filters, user_preferences', 'duration_days, budget_range, theme_tags, traveler_type', 'P1', 'custom-route'),
  item('check-in-light-wall', 'entrance', '打卡光影墙', '墙面浮雕光影+动态投影', '乌镇桥、河、街巷与灯影组成可拍照、可识别的迎宾背景。', 'media_assets, scenic_spots', 'asset_type, image_url, animation_id, spot_id', 'P2'),
  item('wuzhen-streets', 'wuzhen', '古镇街巷复刻3D空间', '1:1全比例3D漫游场景', '还原东栅、西栅、木心美术馆、草木本色染坊、白莲塔；走到景点自动弹窗介绍。', 'attractions, wuzhen_spots, spot_details', 'spot_id, name, description, history, opening_hours, tips, 3d_model_url', 'P0', 'scene'),
  item('wuzhen-boat', 'wuzhen', '乌篷船互动装置', '可点击3D船只模型+航线动画', '点击船只弹出乌镇坐船游览路线、码头顺序、票价、时刻表。', 'boat_routes, wuzhen_transport', 'route_id, stops_sequence, ticket_price, schedule, duration', 'P1', 'detail'),
  item('wuzhen-shops', 'culture', '水乡商铺与住宿', '3D空间内悬浮标签+弹窗', '标注民宿、酒楼、茶馆，读取乌镇美食推荐和住宿评分。', 'accommodations, restaurants, shops', 'shop_id, name, category, rating, address, recommendation', 'P1'),
  item('wuzhen-route-sandtable', 'wuzhen', '乌镇路线规划沙盘', '地面巨型沉浸式动态沙盘', '动态生成一日暴走线、夜景专属线、亲子慢游线、人文文艺线和秋冬赏雪线。', 'routes, wuzhen_routes, route_themes', 'route_id, theme, duration, waypoints, highlight_tags, season', 'P0', 'scene'),
  item('seasonal-lighting', 'culture', '乌镇四季光影', '全场景光照/天气动态系统', '一键切换春雨水巷、盛夏荷花、秋日红叶和冬日薄雪。', 'seasonal_data, best_time_to_visit', 'season, weather_effect, scenery_description, best_months', 'P1'),
  item('folk-culture', 'culture', '木心与水乡非遗', '3D动态展品+非遗动画', '展示木心美术馆、蓝印花布、杭扇、定胜糕和水乡婚俗。', 'folk_culture, intangible_heritage', 'heritage_id, name, category, history, craft_process, video_url', 'P2'),
  item('global-globe', 'global', '东栅水乡路线沙盘', '大型乌镇水系3D沙盘', '呈现东栅老街、河埠、染坊和水上集市的游览关系。', 'wuzhen_spots, wuzhen_routes, route_waypoints', 'spot_id, route_id, waypoint, duration, highlight', 'P0', 'scene'),
  item('region-filter', 'global', '东栅生活地图', '悬浮触控分类菜单', '按老街、民居、染坊、水上集市和清晨路线筛选东栅点位。', 'wuzhen_spots, scenic_categories', 'spot_id, category_tag, opening_hours, tips', 'P1', 'custom-route'),
  item('global-route-wall', 'avatar-control', '西栅夜游与场馆墙', '墙面动态投影+滚动信息卡', '展示西栅老街、木心美术馆、乌镇大剧院和夜游信息。', 'wuzhen_spots, venue_schedule, night_routes', 'spot_id, venue_name, opening_hours, schedule, route_id', 'P0', 'detail'),
  item('southeast-asia-pod', 'global', '蓝印花布染坊', '独立沉浸式小展厅', '展示蓝印花布的纹样、染色流程和水乡作坊空间。', 'folk_culture, craft_process, media_assets', 'heritage_id, craft_step, material, image_url, narration', 'P1'),
  item('europe-pod', 'global', '百床馆与水乡民居', '独立沉浸式小展厅', '展示东栅民居尺度、木构细节和百床馆空间。', 'wuzhen_spots, architecture_details', 'spot_id, room_name, period, material, tips', 'P1'),
  item('wood-carving-gallery', 'global', '乌镇木雕馆', '木雕屏风与工艺展台', '展示乌镇木雕屏风、门窗花板、榫卯结构和传统木工工具，支持点击查看工艺说明。', 'folk_culture, architecture_details, craft_process', 'heritage_id, craft_step, material, period, narration', 'P1'),
  item('domestic-pod', 'global', '乌镇早茶', '独立沉浸式小展厅', '展示水乡清晨饮食、茶点和适合慢游的时间安排。', 'food_guide, local_cuisine', 'food_id, name, serving_time, restaurant, price', 'P1'),
  item('mena-pod', 'global', '水上集市', '独立沉浸式小展厅', '展示河埠、船只和水上集市的拍摄与游览方式。', 'wuzhen_spots, boat_routes, photo_spots', 'spot_id, best_time, route_id, photo_tip, duration', 'P2'),
  item('oceania-pod', 'global', '河埠生活', '独立沉浸式小展厅', '展示乌镇沿河生活、桥梁和临水街巷的空间关系。', 'wuzhen_spots, waterway_map', 'spot_id, river_name, bridge_name, history, tips', 'P2'),
  item('americas-pod', 'global', '乌镇手作', '独立沉浸式小展厅', '展示蓝印花布、木雕、竹编和糕点等可以在乌镇体验的手作内容。', 'folk_culture, workshops, local_products', 'heritage_id, workshop, duration, reservation, tips', 'P2'),
  item('route-comparison', 'global', '东栅路线选择台', '多屏并列触控终端', '对比清晨、午后、夜游和亲子慢行等乌镇路线。', 'wuzhen_routes, route_comparison', 'route_a_id, route_b_id, duration_diff, highlights, traveler_type', 'P2', 'custom-route'),
  item('main-digital-avatar', 'digital-guide', '乌镇主数字导游', '全息投影主机位', '提供乌镇景点讲解、路线规划和问答互动。', 'digital_avatar, avatar_scripts', 'avatar_id, voice_model, knowledge_base_id, response_api', 'P0', 'guide'),
  item('follow-avatar', 'digital-guide', '随行乌镇分身导游', '可移动悬浮全息投影', '游客走到展厅任意区域时，分身可跟随讲解对应乌镇内容。', 'avatar_follow, spatial_tracking', 'avatar_id, follow_mode, spot_triggers, narration_timeline', 'P1'),
  item('multi-avatar', 'digital-guide', '多分身讲解系统', '多机位同步全息投影', '分别讲解东栅、西栅、非遗和路线规划主题。', 'multi_avatar, avatar_roles', 'avatar_ids, role_assignments, sync_mode, topic分配', 'P2'),
  item('voice-status-panel', 'digital-guide', '数字导游联动面板', '可视化数据面板', '展示乌镇路线、景点图文、音频素材和推荐接口状态。', 'api_status, system_monitor, recommendation_engine', 'api_name, status, latency, request_count, recommendation_model', 'P2', 'monitor'),
  item('language-panel', 'digital-guide', '多语种乌镇导览', '语言切换控制面板', '支持中英日韩切换，并同步更新乌镇路线文案和数字人语音。', 'i18n_translations, multilingual_avatar', 'language_code, translated_text, voice_model_lang, switch_api', 'P1'),
  item('itinerary-diy', 'interactive', '行程DIY定制台', '触控大屏+拖拽式编辑器', '勾选景点、天数和偏好，实时生成专属路线并扫码带走攻略。', 'custom_routes, user_itinerary, route_builder', 'user_id, selected_spots, duration, preferences, generated_route, qr_code', 'P0', 'custom-route'),
  item('seasonal-experience', 'interactive', '乌镇四季光影体验舱', '封闭式沉浸体验舱', '切换乌镇春雨、夏荷、秋色与冬雪光影，联动适合游览的季节提示。', 'seasonal_experience, wuzhen_seasons', 'season, visual_effects, ambient_sound, best_time', 'P1'),
  item('digital-guide-kiosk', 'interactive', '数字人讲解台', '路线与语音讲解终端', '选择景点、路线和主题，由数字人提供分段讲解与游览建议。', 'digital_guide, routes, narration', 'spot_id, route_id, narration_topic, duration', 'P1'),
  item('route-ranking', 'interactive', '路线热门排行榜', '动态光影动线+排行榜面板', '统计高频游玩路线，用流动光效高亮热门路线。', 'route_stats, popular_routes, ranking', 'route_id, view_count, booking_count, ranking, trend', 'P1'),
  item('souvenir-shelf', 'supporting', '乌镇文创全息货架', '虚拟悬浮货架+商品3D模型', '展示乌镇蓝印花布、木雕、竹编和地方糕点等伴手礼。', 'souvenirs, products, shopping_guide', 'product_id, name, origin, price, purchase_location, image_url', 'P2'),
  item('transport-wall', 'supporting', '乌镇出行配套信息墙', '动态信息展示墙', '展示前往乌镇的高铁、公交、停车、接驳与景区内步行信息。', 'transportation, wuzhen_transport', 'transport_options, station_routes, shuttle_routes, parking_tips', 'P1'),
  item('food-gallery', 'supporting', '乌镇美食全息长廊', '左右分区悬浮美食3D模型', '展示乌镇酱鸭、定胜糕、白水鱼和早茶等水乡美食，查看门店和推荐吃法。', 'food_guide, local_cuisine, restaurants', 'food_id, name, restaurant, price, rating', 'P1'),
  item('itinerary-export', 'supporting', '行程打印/扫码站', '自助终端+打印机', '将定制路线打印或扫码保存到手机。', 'itinerary_export, qr_codes', 'itinerary_id, export_format, qr_url, print_template', 'P2')
];

export function getExhibitionCatalog(): ExhibitionCatalog {
  return {
    title: '智慧文旅·全息导游 3D 展厅',
    description: '只围绕乌镇西栅、东栅、水系街巷、非遗工艺和数字人讲解展开的数字展厅。',
    source: '智慧文旅·全息导游 3D展厅物件清单.xlsx',
    zones,
    items
  };
}

export function findExhibitionItem(itemId: string): ExhibitionItem | undefined {
  return items.find((item) => item.id === itemId);
}
