import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Contract } from '../models/Contract.js';
import { Customer } from '../models/Customer.js';
import { Elevator } from '../models/Elevator.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

async function getMaxContractSequenceForYear(year) {
  const prefix = `HD-${year}-`;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const out = await Contract.aggregate([
    { $match: { contract_number: { $regex: `^${escapedPrefix}[0-9]+$` } } },
    {
      $addFields: {
        _seq: {
          $toInt: {
            $substrCP: [
              '$contract_number',
              prefix.length,
              { $subtract: [{ $strLenCP: '$contract_number' }, prefix.length] },
            ],
          },
        },
      },
    },
    { $group: { _id: null, maxSeq: { $max: '$_seq' } } },
  ]);

  return out?.[0]?.maxSeq ?? 0;
}

function generateContractDates() {
  const today = new Date();
  const startOffsetDays = randInt(-365, -30);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() + startOffsetDays);

  const durationDays = randInt(30, 365);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);

  // Seed hợp đồng luôn ở trạng thái hoàn thành
  const status = 'completed';

  return { startDate, endDate, status };
}

function buildItems(elevators) {
  if (!elevators.length) return { items: [], total: 0 };

  const items = [];
  let total = 0;
  const itemCount = randInt(1, 4);
  for (let i = 0; i < itemCount; i += 1) {
    const e = pick(elevators);
    const quantity = randInt(1, 3);
    const basePrice = randInt(500_000_000, 2_000_000_000);
    const unitPrice = Math.round(basePrice * (0.9 + Math.random() * 0.3));
    items.push({
      item_type: 'elevator',
      product_id: null,
      elevator_id: e._id,
      quantity,
      unit_price: unitPrice,
    });
    total += quantity * unitPrice;
  }

  return { items, total };
}

function getArgValue(key, defaultValue) {
  const argv = process.argv.slice(2);
  const direct = argv.find((a) => a.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const idx = argv.indexOf(key);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return defaultValue;
}

async function main() {
  const count = Number(getArgValue('--count', '50'));
  const reset = process.argv.slice(2).includes('--reset');

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('Invalid --count. Example: --count 50');
  }

  await connectDB();

  if (reset) {
    const r = await Contract.deleteMany({});
    console.log(`Deleted ${r.deletedCount ?? 0} contracts`);
  }

  const customers = await Customer.find({}).select('_id name').lean();
  const elevators = await Elevator.find({}).select('_id name').lean();

  if (!customers.length) {
    console.warn('Warning: no customers found. Contracts will have null customer_id.');
  }
  if (!elevators.length) {
    console.warn('Warning: no elevators found. Contracts will have empty items and total_value = 0.');
  }

  const year = new Date().getFullYear();
  let seq = await getMaxContractSequenceForYear(year);

  let created = 0;
  for (let i = 0; i < count; i += 1) {
    seq += 1;
    const customer = customers.length ? pick(customers) : null;
    const { startDate, endDate, status } = generateContractDates();
    const { items, total } = buildItems(elevators);

    const payload = {
      customer_id: customer?._id ?? null,
      contract_number: `HD-${year}-${String(seq).padStart(3, '0')}`,
      contract_type: 'installation',
      start_date: startDate,
      end_date: endDate,
      status,
      total_value: total,
      notes: 'Mock data (seed script)',
      items,
    };

    try {
      // eslint-disable-next-line no-await-in-loop
      await new Contract(payload).save();
      created += 1;
    } catch (err) {
      if (err?.code === 11000) {
        // duplicate contract_number, try next sequence
        i -= 1;
        continue;
      }
      throw err;
    }
  }

  console.log(`Seeded ${created} contracts for year ${year}`);
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

