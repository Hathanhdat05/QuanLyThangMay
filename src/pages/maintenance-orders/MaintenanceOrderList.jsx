import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Typography, message, Tag, Input, Select } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const STATUS_MAP = {
  planned: { label: 'Dự kiến', color: 'default' },
  in_progress: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Đã hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'default' },
};

const STATUS_FILTER_BUTTONS = [
  { value: 'all', label: 'Tất cả' },
  ...Object.entries(STATUS_MAP).map(([value, meta]) => ({ value, label: meta.label })),
];

function toSortTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split('-').map((v) => Number(v));
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export default function MaintenanceOrderList({ mineOnly = false }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [assigneeId, setAssigneeId] = useState(undefined);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mineOnly) params.set('mine', '1');
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    if (!mineOnly && isAdmin && assignedOnly) params.set('assigned_only', '1');
    if (!mineOnly && isAdmin && assigneeId) params.set('assignee_id', assigneeId);
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
  }, [statusFilter, search, assignedOnly, assigneeId, mineOnly, isAdmin]);

  useEffect(() => {
    if (!isAdmin || mineOnly) return;
    api.get('/users').then(({ data, error }) => {
      if (error) return;
      const users = Array.isArray(data) ? data.filter((u) => u.role === 'user') : [];
      setAssigneeOptions(
        users.map((u) => ({
          value: u.id,
          label: `${u.full_name || '(Chưa có tên)'} - ${u.email}`,
        }))
      );
    });
  }, [isAdmin, mineOnly]);

  const columns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (v, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/maintenance-orders/${record.id}/detail`, { state: { fromMyJobs: mineOnly } })}
          style={{ padding: 0 }}
        >
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
    ...(isAdmin
      ? [
          {
            title: 'Kỹ thuật viên',
            key: 'assigned_users',
            width: 260,
            render: (_, r) => {
              const users = Array.isArray(r.assigned_users) ? r.assigned_users : [];
              if (users.length === 0) return <span style={{ color: '#999' }}>Chưa gán</span>;
              return (
                <Space size={[4, 4]} wrap>
                  {users.map((u) => (
                    <Tag key={u.id}>{u.full_name || u.email || 'User'}</Tag>
                  ))}
                </Space>
              );
            },
          },
        ]
      : []),
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/maintenance-orders/${record.id}/detail`, { state: { fromMyJobs: mineOnly } })}
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
          {mineOnly ? 'Công việc của tôi' : 'Quản lý đơn bảo trì'}
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
        <Space.Compact>
          {STATUS_FILTER_BUTTONS.map((item) => {
            const isActive = (statusFilter ?? 'all') === item.value;
            return (
              <Button
                key={item.value}
                type={isActive ? 'primary' : 'default'}
                onClick={() => setStatusFilter(item.value === 'all' ? null : item.value)}
              >
                {item.label}
              </Button>
            );
          })}
        </Space.Compact>
        {!mineOnly && isAdmin && (
          <>
            <Button type={assignedOnly ? 'primary' : 'default'} onClick={() => setAssignedOnly((prev) => !prev)}>
              Việc đã giao
            </Button>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Lọc theo user được giao"
              style={{ width: 320 }}
              value={assigneeId}
              onChange={setAssigneeId}
              options={assigneeOptions}
            />
          </>
        )}
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
