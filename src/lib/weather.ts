// src/lib/weather.ts

export type HourlyForecast = {
    time: string;
    temp: number;
    weatherCode: number;
  };
  
  export type DailyForecast = {
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
  };
  
  export type WeatherInfo = {
    temp: number;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    locationName: string;
    hourly: HourlyForecast[];   // ★ 追加：時間ごとの予報
    forecast: DailyForecast[];  // 週間予報
  };
  
  /**
   * 緯度・経度をもとに、気象庁モデル（JMA）の高精度な天気を取得する
   */
  export async function fetchWeatherByCoordinates(
    lat: number,
    lon: number,
    locationName: string
  ): Promise<WeatherInfo> {
    // ★ hourly=temperature_2m,weather_code を追加
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&models=jma_seamless`;
  
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("気象データの取得に失敗しました");
    }
  
    const data = await res.json();
  
    let shortName = locationName;
    const cityMatch = locationName.match(/^.+?[都道府県](.+)/);
    if (cityMatch) {
      shortName = cityMatch[1];
    }
  
    // ★ 現在時刻以降の「時間ごとの予報」を最大24時間分抽出
    const hourly: HourlyForecast[] = [];
    const nowTime = new Date().getTime();
    if (data.hourly && data.hourly.time) {
      for (let i = 0; i < data.hourly.time.length; i++) {
        const t = new Date(data.hourly.time[i]).getTime();
        // 現在時刻の少し前（1時間前）から含める
        if (t >= nowTime - 3600000) {
          hourly.push({
            time: data.hourly.time[i],
            temp: Math.round(data.hourly.temperature_2m[i]),
            weatherCode: data.hourly.weather_code[i],
          });
        }
        if (hourly.length >= 24) break; // 最大24時間分
      }
    }
  
    // 明日以降の4日間を抽出
    const forecast: DailyForecast[] = [];
    if (data.daily && data.daily.time) {
      for (let i = 1; i <= 4; i++) {
        if (data.daily.time[i]) {
          forecast.push({
            date: data.daily.time[i],
            weatherCode: data.daily.weather_code[i],
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
          });
        }
      }
    }
  
    return {
      temp: Math.round(data.current.temperature_2m),
      tempMax: Math.round(data.daily.temperature_2m_max[0]), 
      tempMin: Math.round(data.daily.temperature_2m_min[0]), 
      weatherCode: data.current.weather_code,
      locationName: shortName || locationName,
      hourly,
      forecast,
    };
  }