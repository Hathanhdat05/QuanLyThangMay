import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Elevator } from '../models/Elevator.js';

const ELEVATORS = [
  {
    elevatorId: 'TM20260307-E605EC',
    name: 'Thang gia đình Samsung AJ300KG',
    type: 'Thang gia đình',
    brand: 'Samsung',
    model: 'AJ300KG',
    capacity: 450,
    speed: 1.0,
    description: 'Thang máy gia đình 6 điểm dừng, phù hợp nhà phố, vận hành êm.',
    image_url: '/uploads/elevators/samsung-aj300kg.png',
  },
  {
    elevatorId: 'TM20260307-A1B2C3',
    name: 'Thang tải khách Mitsubishi Elite 1000',
    type: 'Thang tải khách',
    brand: 'Mitsubishi',
    model: 'Elite-1000',
    capacity: 1000,
    speed: 1.75,
    description: 'Thang tải khách cho tòa nhà văn phòng 15 tầng, tiết kiệm năng lượng.',
    image_url: '/uploads/elevators/mitsu-elite-1000.png',
  },
  {
    elevatorId: 'TM20260307-FF23A9',
    name: 'Thang bệnh viện Hitachi MedLift 1600',
    type: 'Thang bệnh viện',
    brand: 'Hitachi',
    model: 'MedLift-1600',
    capacity: 1600,
    speed: 1.6,
    description: 'Thang bệnh viện chuyên dụng chở băng ca, cửa mở rộng, dừng tầng chính xác.',
    image_url: '/uploads/elevators/hitachi-medlift-1600.png',
  },
  {
    elevatorId: 'TM20260307-9C0D1E',
    name: 'Thang quan sát Schindler Panorama 800',
    type: 'Thang quan sát',
    brand: 'Schindler',
    model: 'Panorama-800',
    capacity: 800,
    speed: 2.5,
    description: 'Thang quan sát vách kính toàn phần dành cho trung tâm thương mại.',
    image_url: '/uploads/elevators/schindler-panorama-800.png',
  },
  {
    elevatorId: 'TM20260307-4B7F90',
    name: 'Thang tải hàng Fuji Cargo 2000',
    type: 'Thang tải hàng',
    brand: 'Fuji',
    model: 'Cargo-2000',
    capacity: 2000,
    speed: 0.75,
    description: 'Thang tải hàng hạng nặng cho kho logistics, sàn chống trượt.',
    image_url: '/uploads/elevators/fuji-cargo-2000.png',
  },
  {
    elevatorId: 'TM20260307-C3D4E5',
    name: 'Thang gia đình FujiHome 320',
    type: 'Thang gia đình',
    brand: 'Fuji',
    model: 'FujiHome-320',
    capacity: 320,
    speed: 0.75,
    description: 'Thang gia đình cửa kính, dùng cho nhà 4–6 tầng, tiết kiệm diện tích hố thang.',
    image_url: '/uploads/elevators/fujihome-320.png',
  },
  {
    elevatorId: 'TM20260307-1122AA',
    name: 'Thang tải khách Otis Gen2 800',
    type: 'Thang tải khách',
    brand: 'Otis',
    model: 'Gen2-800',
    capacity: 800,
    speed: 1.6,
    description: 'Thang tải khách sử dụng dây đai thép phủ polyurethane, vận hành êm và bền.',
    image_url: '/uploads/elevators/otis-gen2-800.png',
  },
  {
    elevatorId: 'TM20260307-BEEF01',
    name: 'Thang bệnh viện Thyssenkrupp MedCare 2000',
    type: 'Thang bệnh viện',
    brand: 'Thyssenkrupp',
    model: 'MedCare-2000',
    capacity: 2000,
    speed: 1.75,
    description: 'Thang bệnh viện tải trọng lớn, hỗ trợ chế độ ưu tiên cấp cứu.',
    image_url: '/uploads/elevators/tk-medcare-2000.png',
  },
  {
    elevatorId: 'TM20260307-73ABCD',
    name: 'Thang tải hàng nội bộ Hitachi Cargo 1500',
    type: 'Thang tải hàng',
    brand: 'Hitachi',
    model: 'Cargo-1500',
    capacity: 1500,
    speed: 0.75,
    description: 'Thang tải hàng cho khách sạn, nhà hàng, có chế độ chạy ban đêm.',
    image_url: '/uploads/elevators/hitachi-cargo-1500.png',
  },
  {
    elevatorId: 'TM20260307-9988FF',
    name: 'Thang quan sát KONE Vista 630',
    type: 'Thang quan sát',
    brand: 'KONE',
    model: 'Vista-630',
    capacity: 630,
    speed: 2.0,
    description: 'Thang kính quan sát dùng cho khu du lịch, tầm nhìn 3 mặt.',
    image_url: '/uploads/elevators/kone-vista-630.png',
  },
  {
    elevatorId: 'TM20260307-0F1E2D',
    name: 'Thang gia đình không phòng máy HomeLift 400',
    type: 'Thang gia đình',
    brand: 'Mitsubishi',
    model: 'HomeLift-400',
    capacity: 400,
    speed: 1.0,
    description: 'Thang gia đình không phòng máy, chạy êm, phù hợp cải tạo nhà cũ.',
    image_url: '/uploads/elevators/mitsu-homelift-400.png',
  },
  {
    elevatorId: 'TM20260307-55AA77',
    name: 'Thang tải khách khách sạn Otis Comfort 630',
    type: 'Thang tải khách',
    brand: 'Otis',
    model: 'Comfort-630',
    capacity: 630,
    speed: 1.6,
    description: 'Thang tải khách cho khách sạn 3–4 sao, trang trí inox gương.',
    image_url: '/uploads/elevators/otis-comfort-630.png',
  },
  {
    elevatorId: 'TM20260307-D4C3B2',
    name: 'Thang tải hàng mini Dumbwaiter 100',
    type: 'Thang tải hàng',
    brand: 'Fuji',
    model: 'Dumbwaiter-100',
    capacity: 100,
    speed: 0.4,
    description: 'Thang tải thức ăn cho nhà hàng, bếp trung tâm, vận hành liên tục.',
    image_url: '/uploads/elevators/fuji-dumbwaiter-100.png',
  },
  {
    elevatorId: 'TM20260307-89ABC0',
    name: 'Thang bệnh viện inox sạch MedClean 1600',
    type: 'Thang bệnh viện',
    brand: 'Schindler',
    model: 'MedClean-1600',
    capacity: 1600,
    speed: 1.75,
    description: 'Buồng thang inox kháng khuẩn, phù hợp khu vực phòng mổ và ICU.',
    image_url: '/uploads/elevators/schindler-medclean-1600.png',
  },
  {
    elevatorId: 'TM20260307-1A2B3C',
    name: 'Thang quan sát ngoài trời Panorama 1000',
    type: 'Thang quan sát',
    brand: 'Thyssenkrupp',
    model: 'Panorama-1000',
    capacity: 1000,
    speed: 2.5,
    description: 'Thang quan sát ngoài trời chịu thời tiết, dùng cho tòa nhà cao tầng.',
    image_url: '/uploads/elevators/tk-panorama-1000.png',
  },
  {
    elevatorId: 'TM20260307-4455EE',
    name: 'Thang tải khách tòa nhà văn phòng KONE Office 1000',
    type: 'Thang tải khách',
    brand: 'KONE',
    model: 'Office-1000',
    capacity: 1000,
    speed: 2.0,
    description: 'Thang tải khách văn phòng, tích hợp điều khiển phân tầng thông minh.',
    image_url: '/uploads/elevators/kone-office-1000.png',
  },
  {
    elevatorId: 'TM20260307-77CC99',
    name: 'Thang gia đình kính toàn phần GlassHome 350',
    type: 'Thang gia đình',
    brand: 'Schindler',
    model: 'GlassHome-350',
    capacity: 350,
    speed: 0.75,
    description: 'Thang gia đình vách kính toàn phần, phù hợp biệt thự, nhà phố cao cấp.',
    image_url: '/uploads/elevators/schindler-glasshome-350.png',
  },
  {
    elevatorId: 'TM20260307-F0E1D2',
    name: 'Thang tải hàng nhà máy HeavyCargo 3000',
    type: 'Thang tải hàng',
    brand: 'Mitsubishi',
    model: 'HeavyCargo-3000',
    capacity: 3000,
    speed: 0.5,
    description: 'Thang tải hàng siêu nặng dùng cho nhà máy, kho thép, xe nâng vào được.',
    image_url: '/uploads/elevators/mitsu-heavycargo-3000.png',
  },
  {
    elevatorId: 'TM20260307-2C3D4E',
    name: 'Thang tải khách trung tâm thương mại MallLift 1600',
    type: 'Thang tải khách',
    brand: 'Fuji',
    model: 'MallLift-1600',
    capacity: 1600,
    speed: 2.0,
    description: 'Thang tải khách lưu lượng lớn cho trung tâm thương mại, cửa mở hai phía.',
    image_url: '/uploads/elevators/fuji-malllift-1600.png',
  },
  {
    elevatorId: 'TM20260307-6F7A8B',
    name: 'Thang quan sát tròn SkyView 800',
    type: 'Thang quan sát',
    brand: 'Otis',
    model: 'SkyView-800',
    capacity: 800,
    speed: 2.5,
    description: 'Thang quan sát dạng tròn, kính cong toàn bộ, tạo điểm nhấn kiến trúc.',
    image_url: '/uploads/elevators/otis-skyview-800.png',
  },
];

async function main() {
  await connectDB();

  let created = 0;
  let updated = 0;

  for (const elevator of ELEVATORS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Elevator.findOne({ elevatorId: elevator.elevatorId });
    if (existing) {
      Object.assign(existing, elevator);
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
      updated += 1;
    } else {
      // eslint-disable-next-line no-await-in-loop
      await new Elevator(elevator).save();
      created += 1;
    }
  }

  console.log(`Seeded elevators. Created: ${created}, updated: ${updated}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

