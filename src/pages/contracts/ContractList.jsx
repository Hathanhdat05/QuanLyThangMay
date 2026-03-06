import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message, Tag, Select, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, BASE_URL } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const STATUS_MAP = {
  draft: { label: 'Nháp', color: 'default' },
  active: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'error' },
};

const CONTRACT_TYPE_MAP = {
  installation: { label: 'Lắp đặt', color: 'blue' },
  maintenance: { label: 'Bảo trì', color: 'gold' },
  warranty: { label: 'Bảo hành', color: 'purple' },
};

export default function ContractList() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [createdRange, setCreatedRange] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchContracts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('contract_type', typeFilter);
    if (createdRange && createdRange.length === 2) {
      const [from, to] = createdRange;
      if (from) params.set('created_from', from.startOf('day').toISOString());
      if (to) params.set('created_to', to.endOf('day').toISOString());
    }
    const path = params.toString() ? `/contracts?${params}` : '/contracts';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setContracts(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, [search, statusFilter, typeFilter, createdRange]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/contracts/${id}`);
    if (error) {
      message.error('Lỗi xóa hợp đồng');
    } else {
      message.success('Đã xóa hợp đồng');
      fetchContracts();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedRowKeys) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await api.delete(`/contracts/${id}`);
        if (error) {
          message.error('Lỗi xóa một số hợp đồng, vui lòng thử lại');
          break;
        }
      }
      setSelectedRowKeys([]);
      await fetchContracts();
      message.success('Đã xóa các hợp đồng đã chọn');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    setStatusUpdatingId(id);
    const prev = contracts;
    setContracts((list) => list.map((c) => (c.id === id ? { ...c, status } : c)));
    const { error } = await api.patch(`/contracts/${id}/status`, { status });
    if (error) {
      message.error('Lỗi cập nhật trạng thái');
      setContracts(prev);
    } else {
      message.success('Đã cập nhật trạng thái');
    }
    setStatusUpdatingId(null);
  };

  const formatDate = (val) => {
    if (!val) return '-';
    const d = dayjs(val);
    if (!d.isValid()) return '-';
    return d.format('DD-MM-YYYY');
  };

  const formatCurrency = (val) => (val != null ? Number(val).toLocaleString('vi-VN') + ' đ' : '');

  const exportExcel = async () => {
    try {
      setExportLoading(true);
      const token = api.getToken();
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('contract_type', typeFilter);
      if (createdRange && createdRange.length === 2) {
        const [from, to] = createdRange;
        if (from) params.set('created_from', from.startOf('day').toISOString());
        if (to) params.set('created_to', to.endOf('day').toISOString());
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const url = `${BASE_URL}/contracts/export${qs}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        message.error('Lỗi xuất Excel');
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || 'hop-dong.xlsx';

      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      message.error('Lỗi xuất Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      title: 'Số hợp đồng',
      dataIndex: 'contract_number',
      key: 'contract_number',
      sorter: (a, b) => (a.contract_number || '').localeCompare(b.contract_number || ''),
      render: (text, record) => (
        <span
          onClick={() => navigate(`/contracts/${record.id}/detail`)}
          title={text || record.contract_number || record.id}
          style={{
            display: 'block',
            maxWidth: 200,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#1677ff',
            cursor: 'pointer',
          }}
        >
          {text || record.contract_number || '(Chưa có số)'}
        </span>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, record) => record.customers?.name || '-',
    },
    {
      title: 'Loại hợp đồng',
      dataIndex: 'contract_type',
      key: 'contract_type',
      render: (v) => {
        const t = CONTRACT_TYPE_MAP[v];
        if (!t) return v || '-';
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (v) => formatDate(v),
      sorter: (a, b) => (a.start_date || '').localeCompare(b.start_date || ''),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (v) => formatDate(v),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v) => formatDate(v),
      sorter: (a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
      },
      defaultSortOrder: 'descend',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (v, record) => (
        <Select
          size="small"
          value={v}
          loading={statusUpdatingId === record.id}
          onChange={(value) => handleStatusChange(record.id, value)}
          style={{ minWidth: 150 }}
          options={Object.entries(STATUS_MAP).map(([key, cfg]) => ({
            value: key,
            label: cfg.label,
          }))}
        />
      ),
    },
    {
      title: 'Tổng giá trị',
      dataIndex: 'total_value',
      key: 'total_value',
      width: 180,
      align: 'right',
      render: (value) => (
        <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(value)}</span>
      ),
      sorter: (a, b) => (a.total_value || 0) - (b.total_value || 0),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_, record) =>
        isAdmin ? (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/contracts/${record.id}`)}
            />
            <Popconfirm
              title="Xóa hợp đồng?"
              description="Bạn có chắc muốn xóa hợp đồng này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  const rowSelection = isAdmin
    ? {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
      }
    : undefined;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý Hợp đồng
        </Title>
        {isAdmin && (
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button danger onClick={handleBulkDelete} loading={bulkDeleting}>
                Xóa đã chọn ({selectedRowKeys.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={exportExcel} loading={exportLoading}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/contracts/new')}>
              Thêm hợp đồng
            </Button>
          </Space>
        )}
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Tìm kiếm theo số HĐ (HD-...), ID..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          placeholder="Lọc trạng thái"
          allowClear
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <Select
          placeholder="Lọc loại hợp đồng"
          allowClear
          style={{ width: 200 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={Object.entries(CONTRACT_TYPE_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <DatePicker.RangePicker
          value={createdRange}
          onChange={setCreatedRange}
          format="DD-MM-YYYY"
          placeholder={['Từ ngày tạo', 'Đến ngày tạo']}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={contracts}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} hợp đồng` }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
