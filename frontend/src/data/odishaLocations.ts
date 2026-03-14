export type OdishaLocation = {
  key: string;
  district: string;
  area: string;
  latitude: number;
  longitude: number;
};

export const ODISHA_LOCATIONS: OdishaLocation[] = [
  { key: 'angul', district: 'Angul', area: 'Angul Town', latitude: 20.8444, longitude: 85.1511 },
  { key: 'balangir', district: 'Balangir', area: 'Balangir Town', latitude: 20.7074, longitude: 83.4843 },
  { key: 'balasore', district: 'Balasore', area: 'Balasore Town', latitude: 21.4942, longitude: 86.9317 },
  { key: 'bargarh', district: 'Bargarh', area: 'Bargarh Town', latitude: 21.3335, longitude: 83.6190 },
  { key: 'bhadrak', district: 'Bhadrak', area: 'Bhadrak Town', latitude: 21.0583, longitude: 86.4958 },
  { key: 'boudh', district: 'Boudh', area: 'Boudh Town', latitude: 20.8370, longitude: 84.3270 },
  { key: 'cuttack', district: 'Cuttack', area: 'Cuttack City', latitude: 20.4625, longitude: 85.8828 },
  { key: 'deogarh', district: 'Deogarh', area: 'Deogarh Town', latitude: 21.5383, longitude: 84.7332 },
  { key: 'dhenkanal', district: 'Dhenkanal', area: 'Dhenkanal Town', latitude: 20.6612, longitude: 85.5968 },
  { key: 'gajapati', district: 'Gajapati', area: 'Paralakhemundi', latitude: 18.7833, longitude: 84.0930 },
  { key: 'ganjam', district: 'Ganjam', area: 'Berhampur', latitude: 19.3149, longitude: 84.7941 },
  { key: 'jagatsinghpur', district: 'Jagatsinghpur', area: 'Jagatsinghpur Town', latitude: 20.2549, longitude: 86.1706 },
  { key: 'jajpur', district: 'Jajpur', area: 'Jajpur Road', latitude: 20.8486, longitude: 86.3377 },
  { key: 'jharsuguda', district: 'Jharsuguda', area: 'Jharsuguda Town', latitude: 21.8569, longitude: 84.0062 },
  { key: 'kalahandi', district: 'Kalahandi', area: 'Bhawanipatna', latitude: 19.9072, longitude: 83.1669 },
  { key: 'kandhamal', district: 'Kandhamal', area: 'Phulbani', latitude: 20.4655, longitude: 84.2327 },
  { key: 'kendrapara', district: 'Kendrapara', area: 'Kendrapara Town', latitude: 20.5017, longitude: 86.4223 },
  { key: 'keonjhar', district: 'Keonjhar', area: 'Keonjhar Town', latitude: 21.6289, longitude: 85.5816 },
  { key: 'khordha', district: 'Khordha', area: 'Bhubaneswar', latitude: 20.2961, longitude: 85.8245 },
  { key: 'koraput', district: 'Koraput', area: 'Koraput Town', latitude: 18.8135, longitude: 82.7123 },
  { key: 'malkangiri', district: 'Malkangiri', area: 'Malkangiri Town', latitude: 18.3566, longitude: 81.8880 },
  { key: 'mayurbhanj', district: 'Mayurbhanj', area: 'Baripada', latitude: 21.9352, longitude: 86.7314 },
  { key: 'nabarangpur', district: 'Nabarangpur', area: 'Nabarangpur Town', latitude: 19.2333, longitude: 82.5500 },
  { key: 'nayagarh', district: 'Nayagarh', area: 'Nayagarh Town', latitude: 20.1288, longitude: 85.1009 },
  { key: 'nuapada', district: 'Nuapada', area: 'Nuapada Town', latitude: 20.8153, longitude: 82.5359 },
  { key: 'puri', district: 'Puri', area: 'Puri Town', latitude: 19.8135, longitude: 85.8312 },
  { key: 'rayagada', district: 'Rayagada', area: 'Rayagada Town', latitude: 19.1667, longitude: 83.4167 },
  { key: 'sambalpur', district: 'Sambalpur', area: 'Sambalpur Town', latitude: 21.4669, longitude: 83.9812 },
  { key: 'subarnapur', district: 'Subarnapur', area: 'Sonepur', latitude: 20.8333, longitude: 83.9167 },
  { key: 'sundargarh', district: 'Sundargarh', area: 'Rourkela', latitude: 22.2604, longitude: 84.8536 },
];

export const ODISHA_DEFAULT_CENTER: [number, number] = [20.9517, 85.0985];

export const buildOdishaAddress = (location: OdishaLocation): string => {
  return `${location.area}, ${location.district}, Odisha`;
};

export const findOdishaLocationByCoordinates = (
  latitude?: number | string | null,
  longitude?: number | string | null,
  tolerance = 0.08
): OdishaLocation | null => {
  const lat = typeof latitude === 'string' ? Number(latitude) : latitude;
  const lng = typeof longitude === 'string' ? Number(longitude) : longitude;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return (
    ODISHA_LOCATIONS.find(
      (location) =>
        Math.abs(location.latitude - Number(lat)) <= tolerance &&
        Math.abs(location.longitude - Number(lng)) <= tolerance
    ) || null
  );
};
