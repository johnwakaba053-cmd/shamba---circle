import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

// WeatherAPI condition codes (https://www.weatherapi.com/docs/weather_conditions.json)
// grouped onto the app's own lucide icon set, in Shamba Space colours:
// ochre sun, blue rain/storm, soft-ink cloud/fog.
const FOG = new Set([1030, 1135, 1147]);
const DRIZZLE = new Set([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1198, 1240]);
const RAIN = new Set([1186, 1189, 1192, 1195, 1201, 1243, 1246]);
const THUNDER = new Set([1087, 1273, 1276, 1279, 1282]);
const SNOW = new Set([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264]);

function pick(code: number, isDay: boolean): { Icon: LucideIcon; tone: string } {
  if (code === 1000) return isDay ? { Icon: Sun, tone: "text-shamba-ochre" } : { Icon: Moon, tone: "text-shamba-ink-soft" };
  if (code === 1003) return isDay ? { Icon: CloudSun, tone: "text-shamba-ochre" } : { Icon: CloudMoon, tone: "text-shamba-ink-soft" };
  if (THUNDER.has(code)) return { Icon: CloudLightning, tone: "text-shamba-blue" };
  if (RAIN.has(code)) return { Icon: CloudRain, tone: "text-shamba-blue" };
  if (DRIZZLE.has(code)) return { Icon: CloudDrizzle, tone: "text-shamba-blue" };
  if (SNOW.has(code)) return { Icon: CloudSnow, tone: "text-shamba-blue" };
  if (FOG.has(code)) return { Icon: CloudFog, tone: "text-shamba-ink-soft" };
  return { Icon: Cloud, tone: "text-shamba-ink-soft" }; // 1006 cloudy, 1009 overcast, unknown
}

export function WeatherIcon({
  code,
  isDay,
  className = "",
}: {
  code: number;
  isDay: boolean;
  className?: string;
}) {
  const { Icon, tone } = pick(code, isDay);
  return <Icon className={`${tone} ${className}`} strokeWidth={1.75} aria-hidden="true" />;
}
