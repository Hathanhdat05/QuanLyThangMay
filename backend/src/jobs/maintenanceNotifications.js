import { Elevator } from '../models/Elevator.js';
import { Contract } from '../models/Contract.js';
import { Notification } from '../models/Notification.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function runMaintenanceNotifications() {
  const today = startOfDay(new Date());

  try {
    // 1. Thông báo hết thời hạn bảo trì (thang máy có maintenance_end_date <= hôm nay = đã qua thời hạn bảo trì)
    const dueElevators = await Elevator.find({
      maintenance_end_date: { $ne: null, $lte: new Date() },
    }).lean();

    for (const elev of dueElevators) {
      const refDate = elev.maintenance_end_date ? startOfDay(elev.maintenance_end_date) : today;
      const exists = await Notification.findOne({
        type: 'maintenance_due',
        elevator_id: elev._id,
        reference_date: refDate,
      });
      if (!exists) {
        await Notification.create({
          title: 'Hết thời hạn bảo trì thang máy',
          message: `Thang máy "${elev.name}" (${elev.elevatorId}) đã hết thời hạn bảo trì (đến ${refDate.toISOString().slice(0, 10)}). Vui lòng gia hạn hoặc cập nhật.`,
          type: 'maintenance_due',
          elevator_id: elev._id,
          reference_date: refDate,
        });
      }
    }

    // 2. Thông báo hết hạn hợp đồng bảo trì (contract_type === 'maintenance' và end_date <= hôm nay)
    const expiredContracts = await Contract.find({
      contract_type: 'maintenance',
      end_date: { $ne: null, $lte: new Date() },
    }).lean();

    for (const contract of expiredContracts) {
      const refDate = contract.end_date ? startOfDay(contract.end_date) : today;
      const exists = await Notification.findOne({
        type: 'maintenance_contract_expired',
        contract_id: contract._id,
        reference_date: refDate,
      });
      if (!exists) {
        await Notification.create({
          title: 'Hết hạn hợp đồng bảo trì',
          message: `Hợp đồng bảo trì "${contract.contract_number}" đã hết hạn vào ${refDate.toISOString().slice(0, 10)}. Cần gia hạn hoặc ký mới.`,
          type: 'maintenance_contract_expired',
          contract_id: contract._id,
          reference_date: refDate,
        });
      }
    }
  } catch (err) {
    console.error('Maintenance notifications job error:', err);
  }
}
