import { PROVINCES } from "@/data/provinces";
import { CITIES } from "@/data/cities";

export const PROVINCE_NAMES = PROVINCES.map((province) => province.name);

export function getCitiesByProvinceName(provinceName?: string | null): string[] {
  if (!provinceName) {
    return [];
  }
  const province = PROVINCES.find((item) => item.name === provinceName);
  if (!province) {
    return [];
  }
  return CITIES.filter((city) => city.province_id === province.id).map((city) => city.name);
}

export function isCityInProvince(cityName?: string | null, provinceName?: string | null): boolean {
  if (!cityName || !provinceName) {
    return false;
  }
  const province = PROVINCES.find((item) => item.name === provinceName);
  if (!province) {
    return false;
  }
  return CITIES.some((city) => city.name === cityName && city.province_id === province.id);
}

export function deriveProvinceCityFromRegion(
  region?: string | null
): { province: string; city: string } {
  if (!region) {
    return { province: "", city: "" };
  }
  const trimmed = region.trim();
  if (!trimmed) {
    return { province: "", city: "" };
  }

  const segments = [trimmed, ...trimmed.split(/[-/|,;]+/)]
    .map((segment) => segment.trim())
    .filter((segment, index, array) => segment.length > 0 && array.indexOf(segment) === index);

  let provinceName = "";
  let cityName = "";

  // Prioritise explicit city matches to capture province from city metadata
  for (const segment of segments) {
    const city = CITIES.find((item) => item.name === segment);
    if (city) {
      cityName = city.name;
      const province = PROVINCES.find((item) => item.id === city.province_id);
      if (province) {
        provinceName = province.name;
      }
      break;
    }
  }

  // If province still unknown, try to resolve directly
  if (!provinceName) {
    const provinceDirect = PROVINCES.find((province) => province.name === trimmed);
    if (provinceDirect) {
      provinceName = provinceDirect.name;
    } else {
      for (const segment of segments) {
        const province = PROVINCES.find((item) => item.name === segment);
        if (province) {
          provinceName = province.name;
          break;
        }
      }
    }
  }

  // If city missing but province known, attempt to find city within same province
  if (!cityName && provinceName) {
    const province = PROVINCES.find((item) => item.name === provinceName);
    if (province) {
      const city = segments
        .map((segment) => CITIES.find((item) => item.name === segment && item.province_id === province.id))
        .find((candidate) => candidate);
      if (city) {
        cityName = city.name;
      }
    }
  }

  // As a final fallback, if the trimmed value matches a city exactly, set province
  if (!cityName) {
    const directCity = CITIES.find((city) => city.name === trimmed);
    if (directCity) {
      cityName = directCity.name;
      const province = PROVINCES.find((item) => item.id === directCity.province_id);
      if (province) {
        provinceName = province.name;
      }
    }
  }

  return { province: provinceName, city: cityName };
}
