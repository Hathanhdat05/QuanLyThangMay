import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { api, BASE_URL } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const fetchCustomers = async () => {
    setLoading(true);
    const path = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setCustomers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/customers/${id}`);
    if (error) {
      message.error('Lỗi xóa khách hàng');
    } else {
      message.success('Đã xóa khách hàng');
      fetchCustomers();
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedRowKeys) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await api.delete(`/customers/${id}`);
        if (error) {
          message.error('Lỗi xóa một số khách hàng, vui lòng thử lại');
          break;
        }
      }
      setSelectedRowKeys([]);
      await fetchCustomers();
      message.success('Đã xóa các khách hàng đã chọn');
    } finally {
      setBulkDeleting(false);
    }
  };

  const exportExcel = async () => {
    try {
      setExportLoading(true);
      const token = api.getToken();
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const url = `${BASE_URL}/customers/export${qs}`;

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
      const filename = match?.[1] || 'khach-hang.xlsx';

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
      title: 'ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 160,
      sorter: (a, b) => (a.customerId || '').localeCompare(b.customerId || ''),
    },
    {
      title: 'Tên khách hàng',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (text, record) => (
        <span
          onClick={() => navigate(`/customers/${record.id}/detail`)}
          title={text || '(Không tên)'}
          style={{
            display: 'block',
            maxWidth: 260,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#1677ff',
            cursor: 'pointer',
          }}
        >
          {text || '(Không tên)'}
        </span>
      ),
      width: 260,
    },
    {
      title: 'Loại',
      dataIndex: 'customerType',
      key: 'customerType',
      width: 140,
      render: (v) => (v === 'business' ? 'Doanh nghiệp' : 'Cá nhân'),
      filters: [
        { text: 'Cá nhân', value: 'individual' },
        { text: 'Doanh nghiệp', value: 'business' },
      ],
      onFilter: (value, record) => (record.customerType || 'individual') === value,
    },
    {
      title: 'Vùng miền',
      dataIndex: 'region',
      key: 'region',
      width: 120,
      render: (v) => v || '-',
      sorter: (a, b) => (a.region || '').localeCompare(b.region || ''),
      filters: [
        { text: 'Miền Bắc', value: 'Miền Bắc' },
        { text: 'Miền Trung', value: 'Miền Trung' },
        { text: 'Miền Nam', value: 'Miền Nam' },
      ],
      onFilter: (value, record) => (record.region || '') === value,
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address', ellipsis: true },
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
              onClick={() => navigate(`/customers/${record.id}`)}
            />
            <Popconfirm
              title="Xóa khách hàng?"
              description="Bạn có chắc muốn xóa khách hàng này?"
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
          Quản lý Khách hàng
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/customers/new')}>
              Thêm khách hàng
            </Button>
          </Space>
        )}
      </div>

      <Input
        placeholder="Tìm kiếm theo ID (KH...), tên, email, SĐT..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} khách hàng` }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
