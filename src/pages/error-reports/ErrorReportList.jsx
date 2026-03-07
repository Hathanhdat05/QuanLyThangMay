import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message, Tag, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', color: 'default' },
  in_progress: { label: 'Đang xử lý', color: 'processing' },
  resolved: { label: 'Đã xử lý', color: 'success' },
  closed: { label: 'Đã đóng', color: 'purple' },
};

const PRIORITY_MAP = {
  low: { label: 'Thấp', color: 'green' },
  medium: { label: 'Trung bình', color: 'blue' },
  high: { label: 'Cao', color: 'orange' },
  critical: { label: 'Nghiêm trọng', color: 'red' },
};

export default function ErrorReportList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchReports = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const path = params.toString() ? `/error-reports?${params}` : '/error-reports';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setReports(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [search, statusFilter]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/error-reports/${id}`);
    if (error) {
      message.error('Lỗi xóa báo lỗi');
    } else {
      message.success('Đã xóa báo lỗi');
      fetchReports();
    }
  };

  const handleStatusChange = async (id, nextStatus) => {
    const oldReports = [...reports];
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r))
    );
    const { error } = await api.patch(`/error-reports/${id}/status`, { status: nextStatus });
    if (error) {
      message.error('Không thể cập nhật trạng thái');
      setReports(oldReports);
    } else {
      message.success('Đã cập nhật trạng thái');
      fetchReports();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedRowKeys) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await api.delete(`/error-reports/${id}`);
        if (error) {
          message.error('Lỗi xóa một số báo lỗi, vui lòng thử lại');
          break;
        }
      }
      setSelectedRowKeys([]);
      await fetchReports();
      message.success('Đã xóa các báo lỗi đã chọn');
    } finally {
      setBulkDeleting(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'errorId',
      key: 'errorId',
      width: 180,
      render: (v, record) =>
        v ? (
          <Button type="link" onClick={() => navigate(`/error-reports/${record.id}/detail`)}>
            {v}
          </Button>
        ) : (
          '-'
        ),
    },
    { title: 'Tiêu đề', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Mức độ',
      dataIndex: 'priority',
      key: 'priority',
      width: 130,
      render: (v) => {
        const p = PRIORITY_MAP[v] || { label: v, color: 'default' };
        return <Tag color={p.color}>{p.label}</Tag>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (v, record) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' };
        if (!isAdmin) {
          return <Tag color={s.color}>{s.label}</Tag>;
        }
        return (
          <div style={{ minWidth: 150 }}>
            <Select
              size="small"
              value={record.status}
              style={{ width: '100%' }}
              onChange={(value) => handleStatusChange(record.id, value)}
              options={Object.entries(STATUS_MAP).map(([k, cfg]) => ({
                value: k,
                label: cfg.label,
              }))}
            />
          </div>
        );
      },
    },
    {
      title: 'Thang máy',
      key: 'elevator',
      width: 220,
      ellipsis: true,
      render: (_, r) => r.elevators?.name || '-',
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      width: 220,
      ellipsis: true,
      render: (_, r) => r.customers?.name || '-',
    },
    {
      title: 'Ngày hẹn',
      dataIndex: 'scheduled_date',
      key: 'scheduled_date',
      width: 130,
      render: (v) => {
        if (!v) return '-';
        const date = dayjs(v);
        if (!date.isValid()) return '-';
        return date.format('DD-MM-YYYY');
      },
      sorter: (a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/error-reports/${record.id}`)}
          />
          {isAdmin && (
            <Popconfirm
              title="Xóa báo lỗi?"
              description="Bạn có chắc muốn xóa báo lỗi này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
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
          Quản lý Báo lỗi
        </Title>
        <Space>
          {isAdmin && selectedRowKeys.length > 0 && (
            <Button danger onClick={handleBulkDelete} loading={bulkDeleting}>
              Xóa đã chọn ({selectedRowKeys.length})
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/error-reports/new')}>
            Tạo báo lỗi
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Tìm kiếm theo tiêu đề..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          placeholder="Lọc trạng thái"
          allowClear
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} báo lỗi` }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
