import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

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

const ERROR_REPORT_STATUS_MAP = {
  pending: { label: 'Chờ xử lý', color: 'default' },
  in_progress: { label: 'Đang xử lý', color: 'processing' },
  resolved: { label: 'Đã xử lý', color: 'success' },
  closed: { label: 'Đã đóng', color: 'default' },
};

export default function ContractDetail() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorReports, setErrorReports] = useState([]);
  const [errorReportsLoading, setErrorReportsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const fromMaintenanceCalendar = location.state?.fromMaintenanceCalendar;
  const fromErrorReportId = location.state?.fromErrorReportId;
  const returnToCalendarWithErrorReportId = location.state?.returnToCalendarWithErrorReportId;
  const returnToCalendarWithScheduleId = location.state?.returnToCalendarWithScheduleId;
  const fromCustomerId = location.state?.fromCustomerId;

  const formatDate = (val) => {
    if (!val) return '-';
    const d = dayjs(val);
    if (!d.isValid()) return '-';
    return d.format('DD-MM-YYYY');
  };

  const formatCurrency = (val) => (val != null ? `${Number(val).toLocaleString('vi-VN')} đ` : '-');

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/contracts/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy hợp đồng');
        navigate(returnToCalendarWithScheduleId
          ? '/maintenance-calendar'
          : returnToCalendarWithErrorReportId
            ? '/maintenance-calendar'
            : fromErrorReportId
              ? `/error-reports/${fromErrorReportId}/detail`
              : fromCustomerId
                ? `/customers/${fromCustomerId}/detail`
                : fromMaintenanceCalendar
                  ? '/maintenance-calendar'
                  : '/contracts',
        returnToCalendarWithScheduleId
          ? { state: { openScheduleId: returnToCalendarWithScheduleId } }
          : returnToCalendarWithErrorReportId
            ? { state: { openErrorReportId: returnToCalendarWithErrorReportId } }
            : undefined);
        return;
      }
      setContract(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const run = async () => {
      setErrorReportsLoading(true);
      const { data, error } = await api.get(`/contracts/${id}/error-reports`);
      if (!isMounted) return;
      if (!error && Array.isArray(data)) {
        setErrorReports(data);
      } else {
        setErrorReports([]);
      }
      setErrorReportsLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !contract) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const items = contract.contract_products || [];
  const totalProductsAmount = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const customer = contract.customers;
  const hasFullCustomer = customer && (customer.customerId != null || customer.email != null || customer.phone != null);

  const productColumns = [
    {
      title: 'Loại',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (v) => (v === 'elevator' ? 'Thang máy' : 'Sản phẩm'),
    },
    {
      title: 'Tên',
      key: 'name',
      render: (_, record) => {
        const name = record.products?.name || record.elevator?.name || '-';
        if (record.item_type === 'elevator' && record.elevator_id) {
          return (
            <Button type="link" size="small" onClick={() => navigate(`/elevators/${record.elevator_id}/detail`, { state: { fromContractId: id } })} style={{ padding: 0 }}>
              {name}
            </Button>
          );
        }
        if (record.item_type === 'product' && record.product_id) {
          return (
            <Button type="link" size="small" onClick={() => navigate(`/products/${record.product_id}`, { state: { fromContractId: id } })} style={{ padding: 0 }}>
              {name}
            </Button>
          );
        }
        return name;
      },
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right',
      render: (v) => formatCurrency(v),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right',
      render: (_, record) => formatCurrency((record.quantity || 0) * (record.unit_price || 0)),
    },
  ];

  const typeCfg = CONTRACT_TYPE_MAP[contract.contract_type];
  const statusCfg = STATUS_MAP[contract.status];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            navigate(returnToCalendarWithScheduleId
              ? '/maintenance-calendar'
              : returnToCalendarWithErrorReportId
                ? '/maintenance-calendar'
                : fromErrorReportId
                  ? `/error-reports/${fromErrorReportId}/detail`
                  : fromCustomerId
                    ? `/customers/${fromCustomerId}/detail`
                    : fromMaintenanceCalendar
                      ? '/maintenance-calendar'
                      : '/contracts',
            returnToCalendarWithScheduleId
              ? { state: { openScheduleId: returnToCalendarWithScheduleId } }
              : returnToCalendarWithErrorReportId
                ? { state: { openErrorReportId: returnToCalendarWithErrorReportId } }
                : undefined)
          }
        >
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết hợp đồng
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/contracts/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card title="Thông tin hợp đồng">
          <Descriptions column={2} bordered size="middle">
            <Descriptions.Item label="Số hợp đồng" span={1}>
              {contract.contract_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng" span={1}>
              {contract.customer_id ? (
                <Button type="link" size="small" onClick={() => navigate(`/customers/${contract.customer_id}/detail`)} style={{ padding: 0 }}>
                  {contract.customers?.name || '-'}
                </Button>
              ) : (
                contract.customers?.name || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Loại hợp đồng" span={1}>
              {typeCfg ? <Tag color={typeCfg.color}>{typeCfg.label}</Tag> : contract.contract_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái" span={1}>
              {statusCfg ? <Tag color={statusCfg.color}>{statusCfg.label}</Tag> : contract.status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu" span={1}>
              {formatDate(contract.start_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc" span={1}>
              {formatDate(contract.end_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng giá trị" span={2}>
              {formatCurrency(contract.total_value)}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú" span={2}>
              {contract.notes || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {hasFullCustomer && (
          <Card title="Thông tin khách hàng">
            <Descriptions column={2} bordered size="middle">
              <Descriptions.Item label="ID khách hàng">{customer.customerId || '-'}</Descriptions.Item>
              <Descriptions.Item label="Tên khách hàng">{customer.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Loại khách hàng">
                {customer.customerType === 'business' ? 'Doanh nghiệp' : customer.customerType === 'individual' ? 'Cá nhân' : (customer.customerType || '-')}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{customer.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Khu vực">{customer.region || '-'}</Descriptions.Item>
              <Descriptions.Item label="Tỉnh / Thành phố">{customer.province || '-'}</Descriptions.Item>
              <Descriptions.Item label="Quận / Huyện">{customer.district || '-'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ chi tiết" span={2}>{customer.addressDetail || '-'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ đầy đủ" span={2}>{customer.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú" span={2}>{customer.note || '-'}</Descriptions.Item>
            </Descriptions>
          
          </Card>
        )}

        <Card title="Sản phẩm trong hợp đồng">
          <Table
            columns={productColumns}
            dataSource={items}
            rowKey={(record) => record.id || `${record.item_type}-${record.product_id || record.elevator_id}`}
            pagination={false}
            size="small"
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Text strong>Tổng tiền sản phẩm: {formatCurrency(totalProductsAmount)}</Text>
          </div>

          {contract.contract_type === 'installation' &&
            contract.status === 'completed' &&
            (() => {
              const elevatorItems = items.filter(
                (it) => it.item_type === 'elevator' && it.elevator && (it.elevator.maintenance_months != null || it.elevator.maintenance_frequency_per_month != null)
              );
              if (elevatorItems.length === 0) return null;
              const maintenanceStart = contract.end_date ? dayjs(contract.end_date) : null;
              return (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Thời hạn bảo trì (tính từ ngày hoàn thành hợp đồng)
                  </Text>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Lịch bảo trì được tạo tự động khi hợp đồng có ngày bắt đầu/kết thúc và chuyển trạng thái Hoàn thành.
                  </Text>
                  <Table
                    dataSource={elevatorItems.map((it) => {
                      const months = it.elevator?.maintenance_months ?? 0;
                      const endDate = maintenanceStart && months > 0 ? maintenanceStart.add(months, 'month') : null;
                      return {
                        key: it.id || it.elevator_id,
                        elevator_id: it.elevator_id,
                        name: it.elevator?.name || 'Thang máy',
                        start_date: maintenanceStart?.format('DD-MM-YYYY') || '-',
                        end_date: endDate?.format('DD-MM-YYYY') || '-',
                        frequency:
                          it.elevator?.maintenance_frequency_per_month != null
                            ? `${it.elevator.maintenance_frequency_per_month} tháng/lần`
                            : '-',
                      };
                    })}
                    columns={[
                      {
                        title: 'Thang máy',
                        dataIndex: 'name',
                        key: 'name',
                        render: (name, record) =>
                          record.elevator_id ? (
                            <Button type="link" size="small" onClick={() => navigate(`/elevators/${record.elevator_id}/detail`, { state: { fromContractId: id } })} style={{ padding: 0 }}>
                              {name}
                            </Button>
                          ) : (
                            name
                          ),
                      },
                      { title: 'Ngày bắt đầu', dataIndex: 'start_date', key: 'start_date' },
                      { title: 'Ngày kết thúc', dataIndex: 'end_date', key: 'end_date' },
                      { title: 'Tần suất bảo trì', dataIndex: 'frequency', key: 'frequency' },
                    ]}
                    pagination={false}
                    size="small"
                  />
                </div>
              );
            })()}
        </Card>

        <Card title="Lịch sử bảo trì bảo dưỡng">
          {errorReportsLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : errorReports.length === 0 ? (
            <Text type="secondary">Chưa có bản ghi bảo trì/bảo dưỡng nào liên kết với hợp đồng này.</Text>
          ) : (
            <Table
              dataSource={errorReports}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: 'Mã báo lỗi',
                  dataIndex: 'errorId',
                  key: 'errorId',
                  render: (val, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() =>
                        navigate(`/error-reports/${record.id}/detail`, {
                          state: { fromContractId: id },
                        })
                      }
                      style={{ padding: 0 }}
                    >
                      {val || record.id}
                    </Button>
                  ),
                },
                {
                  title: 'Ngày báo',
                  dataIndex: 'reported_date',
                  key: 'reported_date',
                  render: (v) => formatDate(v),
                },
                {
                  title: 'Tiêu đề',
                  dataIndex: 'title',
                  key: 'title',
                  ellipsis: true,
                },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  key: 'status',
                  render: (v) => {
                    const cfg = ERROR_REPORT_STATUS_MAP[v];
                    return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
                  },
                },
                {
                  title: 'Thang máy',
                  key: 'elevator',
                  render: (_, r) => r.elevators?.name || '-',
                },
                {
                  title: 'Hợp đồng liên kết',
                  key: 'contract',
                  render: (_, r) => {
                    if (!r.contracts?.contract_number) return '-';
                    const typeLabel = r.contracts.contract_type === 'maintenance' ? 'Bảo trì' : r.contracts.contract_type === 'warranty' ? 'Bảo hành' : r.contracts.contract_type || '';
                    return (
                      <span>
                        {r.contract_id === id ? (
                          <Tag color="blue">HĐ này</Tag>
                        ) : (
                          <>
                            {r.contracts.contract_number}
                            {typeLabel && <Tag color={r.contracts.contract_type === 'warranty' ? 'purple' : 'gold'}>{typeLabel}</Tag>}
                          </>
                        )}
                      </span>
                    );
                  },
                },
                {
                  title: '',
                  key: 'action',
                  width: 80,
                  render: (_, record) =>
                    record.contract_id === id ? null : (
                      <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() =>
                          navigate(`/error-reports/${record.id}/detail`, {
                            state: { fromContractId: id },
                          })
                        }
                      >
                        Chi tiết
                      </Button>
                    ),
                },
              ]}
            />
          )}
        </Card>
      </Space>
    </div>
  );
}

