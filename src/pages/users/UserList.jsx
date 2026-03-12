import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Popconfirm, Typography, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';

const { Title } = Typography;

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true);
    const path = search ? `/users?search=${encodeURIComponent(search)}` : '/users';
    const { data, error } = await api.get(path);
    if (error) {
      message.error('Lỗi tải dữ liệu');
    } else {
      setUsers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleDelete = async (id) => {
    const { error } = await api.delete(`/users/${id}`);
    if (error) {
      message.error('Lỗi xóa user');
    } else {
      message.success('Đã xóa user');
      fetchUsers();
    }
  };

  const columns = [
    {
      title: 'Họ tên',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (v) => (
        <Tag color={v === 'admin' ? 'red' : 'blue'}>
          {v === 'admin' ? 'Quản trị viên' : 'Người dùng'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'created_at',
      render: (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : '-'),
      sorter: (a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/users/${record.id}`)} />
          <Popconfirm
            title="Xóa user?"
            description="Bạn có chắc muốn xóa user này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý User
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/users/new')}>
          Thêm User
        </Button>
      </div>

      <Input
        placeholder="Tìm kiếm theo tên, SĐT..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} user` }}
      />
    </div>
  );
}
