/** 天气（Weather）领域类型 —— 数据源：高德地图 Web 服务 API */

/** 温度单位（高德实况天气固定返回摄氏度，保留该类型以兼容其它数据源） */
export type TemperatureUnit = 'metric' | 'imperial'

/** 归一化后的天气数据（与具体数据源解耦） */
export interface WeatherData {
  /** 城市名，如「北京市」 */
  city: string
  /** 省份/上级区域名，如「北京」 */
  province?: string
  /** 当前温度（摄氏度） */
  temperature: number
  /** 体感温度（高德实况不提供，故可选） */
  feelsLike?: number
  /** 天气描述，如「晴」「多云」「小雨」 */
  description: string
  /** 展示图标（emoji，由天气描述映射，不依赖外部图片） */
  icon: string
  /** 湿度 % */
  humidity: number
  /** 风向描述，如「西北」 */
  windDirection?: string
  /** 风力级别，如「≤3」 */
  windPower?: string
  /** 风速（高德实况不提供，故可选） */
  windSpeed?: number
  /** 数据发布时间（时间戳 ms） */
  updatedAt: number
}

/** 天气加载状态 */
export type WeatherLoadState = 'loading' | 'success' | 'error'

/**
 * 逆地理编码得到的地点信息（自动定位用）。
 * 注意：行政区名必须从逆地理编码取 —— 天气接口按区级 adcode 查询时，
 * 返回的 `city` 字段其实是**区名**，拿不到真正的城市名。
 */
export interface LocatedPlace {
  /** 区级 adcode，可直接用于天气查询 */
  adcode: string
  /** 省份名 / 直辖市名，如「江西省」「上海市」 */
  province?: string
  /** 城市名；**直辖市为空**（高德返回空数组），此时城市即 province */
  city?: string
  /** 区县名，如「青山湖区」 */
  district?: string
}

/** 默认城市（高德天气要求 adcode；北京 110000。也可填中文城市名，会先做地理编码） */
export const DEFAULT_WEATHER_CITY = '北京'
