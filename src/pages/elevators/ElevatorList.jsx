import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message, Tag, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { ELEVATOR_TYPES, ELEVATOR_BRANDS } from '../../constants/elevators';

const { Title } = Typography;

export default function ElevatorList() {
  const [elevators, setElevators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState();
  const [brandFilter, setBrandFilter] = useState();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchElevators = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    if (brandFilter) params.set('brand', brandFilter);
    const query = params.toString();
    const path = query ? `/elevators?${query}` : '/elevators';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setElevators(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchElevators();
  }, [search, typeFilter, brandFilter]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/elevators/${id}`);
    if (error) {
      message.error('Lỗi xóa thang máy');
    } else {
      message.success('Đã xóa thang máy');
      fetchElevators();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedRowKeys) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await api.delete(`/elevators/${id}`);
        if (error) {
          message.error('Lỗi xóa một số thang máy, vui lòng thử lại');
          break;
        }
      }
      setSelectedRowKeys([]);
      await fetchElevators();
      message.success('Đã xóa các thang máy đã chọn');
    } finally {
      setBulkDeleting(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'elevatorId',
      key: 'elevatorId',
      width: 160,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      render: (v) => (v ? <Tag color="blue">{v}</Tag> : '-'),
    },
    { title: 'Thương hiệu', dataIndex: 'brand', key: 'brand' },
    { title: 'Model', dataIndex: 'model', key: 'model' },
    {
      title: 'Tải trọng (kg)',
      dataIndex: 'capacity',
      key: 'capacity',
      sorter: (a, b) => (a.capacity || 0) - (b.capacity || 0),
    },
    { title: 'Tốc độ (m/s)', dataIndex: 'speed', key: 'speed' },
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
              onClick={() => navigate(`/elevators/${record.id}`)}
            />
            <Popconfirm
              title="Xóa thang máy?"
              description="Bạn có chắc muốn xóa thang máy này?"
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
          Quản lý Thang máy
        </Title>
        {isAdmin && (
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button danger onClick={handleBulkDelete} loading={bulkDeleting}>
                Xóa đã chọn ({selectedRowKeys.length})
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/elevators/new')}>
              Thêm thang máy
            </Button>
          </Space>
        )}
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Tìm kiếm theo ID, tên, loại, thương hiệu..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
          allowClear
        />
        <Select
          placeholder="Lọc theo loại"
          allowClear
          style={{ width: 180 }}
          value={typeFilter}
          onChange={(value) => setTypeFilter(value)}
          options={ELEVATOR_TYPES.map((v) => ({ label: v, value: v }))}
        />
        <Select
          placeholder="Lọc theo thương hiệu"
          allowClear
          style={{ width: 200 }}
          value={brandFilter}
          onChange={(value) => setBrandFilter(value)}
          options={ELEVATOR_BRANDS.map((v) => ({ label: v, value: v }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={elevators}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} thang máy` }}
      />
    </div>
  );
}
