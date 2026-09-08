/** 天气（Weather）领域类型 */

/** 温度单位 */
export type TemperatureUnit = 'metric' | 'imperial'

/** 天气图标代码 -> 语义描述（OpenWeatherMap icon 字段） */
export type WeatherIconCode = string

/** 归一化后的天气数据 */
export interface WeatherData {
  /** 城市名 */
  city: string
  /** 国家代码，如 CN */
  country?: string
  /** 当前温度（按单位） */
  temperature: number
  /** 体感温度 */
  feelsLike: number
  /** 天气描述，如 Clear */
  description: string
  /** 图标代码 */
  icon: WeatherIconCode
  /** 湿度 % */
  humidity: number
  /** 风速（按单位） */
  windSpeed: number
  /** 数据更新时间（时间戳 ms） */
  updatedAt: number
}

/** 天气加载状态 */
export type WeatherLoadState = 'loading' | 'success' | 'error'

/** 默认城市 */
export const DEFAULT_WEATHER_CITY = '北京'
