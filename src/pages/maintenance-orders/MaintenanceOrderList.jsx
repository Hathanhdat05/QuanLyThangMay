import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Typography, message, Tag, Select, Input } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';

const { Title } = Typography;

const STATUS_MAP = {
  planned: { label: 'Dự kiến', color: 'default' },
  in_progress: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Đã hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'default' },
};

function toSortTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split('-').map((v) => Number(v));
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export default function MaintenanceOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const path = params.toString() ? `/maintenance-orders?${params}` : '/maintenance-orders';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu đơn bảo trì');
    } else {
      setOrders(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, search]);

  const columns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (v, record) => (
        <Button type="link" onClick={() => navigate(`/maintenance-orders/${record.id}/detail`)} style={{ padding: 0 }}>
          {v || 'Đơn bảo trì'}
        </Button>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'customer_name',
      width: 200,
      ellipsis: true,
      render: (_, r) => r.customer_name || '-',
    },
    {
      title: 'Hợp đồng',
      key: 'contract_number',
      width: 160,
      render: (_, r) => r.contract_number || '-',
    },
    {
      title: 'Thang máy',
      key: 'elevator_name',
      width: 180,
      ellipsis: true,
      render: (_, r) => r.elevator_name || '-',
    },
    {
      title: 'Ngày bảo trì',
      dataIndex: 'scheduled_date',
      key: 'scheduled_date',
      width: 130,
      defaultSortOrder: 'ascend',
      render: (v) => {
        if (!v) return '-';
        const d = dayjs(v);
        return d.isValid() ? d.format('DD-MM-YYYY') : '-';
      },
      sorter: (a, b) => toSortTimestamp(a.scheduled_date) - toSortTimestamp(b.scheduled_date),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/maintenance-orders/${record.id}/detail`)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý đơn bảo trì
        </Title>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Tìm theo hợp đồng, khách hàng, thang máy..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 340 }}
        />
        <Select
          placeholder="Lọc trạng thái"
          allowClear
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} đơn bảo trì`,
        }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
