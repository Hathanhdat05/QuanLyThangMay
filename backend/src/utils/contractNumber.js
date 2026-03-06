import { Contract } from '../models/Contract.js';
import { Counter } from '../models/Counter.js';

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

export async function generateNextContractNumber() {
  const year = new Date().getFullYear();
  const key = `contract-${year}`;

  const maxSeq = await getMaxContractSequenceForYear(year);
  // Ensure counter exists and is not behind current max from contracts (if data was imported/modified)
  await Counter.updateOne(
    { key },
    { $setOnInsert: { key }, $max: { seq: maxSeq } },
    { upsert: true }
  ).lean();
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true }
  ).lean();
  const seq = counter?.seq ?? 1;
  return `HD-${year}-${String(seq).padStart(3, '0')}`;
}

export async function previewNextContractNumber() {
  const year = new Date().getFullYear();
  const key = `contract-${year}`;
  const [maxSeq, counter] = await Promise.all([
    getMaxContractSequenceForYear(year),
    Counter.findOne({ key }).select('seq').lean(),
  ]);
  const nextSeq = Math.max(maxSeq, counter?.seq ?? 0) + 1;
  return `HD-${year}-${String(nextSeq).padStart(3, '0')}`;
}

