import { getProvinces, getDistricts } from 'vietnam-provinces';

const PROVINCE_NAME_OVERRIDES = {
  'Hồ Chí Minh': 'TP. Hồ Chí Minh',
};

const DISTRICT_NAME_PREFIX_REGEX = /^(Quận|Huyện|Thị xã|Thành phố)\s+/u;

function normalizeProvinceName(name) {
  const stripped = String(name || '').replace(/^(Tỉnh|Thành phố)\s+/u, '').trim();
  return PROVINCE_NAME_OVERRIDES[stripped] || stripped;
}

function normalizeDistrictValue(districtName) {
  return String(districtName || '').replace(DISTRICT_NAME_PREFIX_REGEX, '').trim();
}

const provinceSource = getProvinces();

export const provinces = provinceSource
  .map((item) => {
    const normalized = normalizeProvinceName(item.name);
    return {
      code: item.code,
      value: normalized,
      label: normalized,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'vi'));

/** Quận/Huyện theo Tỉnh/Thành phố. province -> [ { value, label } ] */
export const districtsByProvince = Object.fromEntries(
  provinces.map((province) => {
    const districts = getDistricts(province.code)
      .map((district) => ({
        value: normalizeDistrictValue(district.name),
        label: district.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));

    return [province.value, districts];
  })
);
