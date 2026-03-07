import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

export default function CustomerDetail() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const fromMaintenanceCalendar = location.state?.fromMaintenanceCalendar;
  const fromErrorReportId = location.state?.fromErrorReportId;
  const returnToCalendarWithErrorReportId = location.state?.returnToCalendarWithErrorReportId;
  const returnToCalendarWithScheduleId = location.state?.returnToCalendarWithScheduleId;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/customers/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy khách hàng');
        navigate(returnToCalendarWithScheduleId
          ? '/maintenance-calendar'
          : returnToCalendarWithErrorReportId
            ? '/maintenance-calendar'
            : fromErrorReportId
              ? `/error-reports/${fromErrorReportId}/detail`
              : fromMaintenanceCalendar
                ? '/maintenance-calendar'
                : '/customers',
        returnToCalendarWithScheduleId
          ? { state: { openScheduleId: returnToCalendarWithScheduleId } }
          : returnToCalendarWithErrorReportId
            ? { state: { openErrorReportId: returnToCalendarWithErrorReportId } }
            : undefined);
        return;
      }
      setCustomer(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !customer) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

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
                  : fromMaintenanceCalendar
                    ? '/maintenance-calendar'
                    : '/customers',
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
          Chi tiết khách hàng
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/customers/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="ID khách hàng">{customer.customerId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên khách hàng">{customer.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loại khách hàng">
            {customer.customerType === 'business' ? 'Doanh nghiệp' : 'Cá nhân'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{customer.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Khu vực">{customer.region || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tỉnh / Thành phố">{customer.province || '-'}</Descriptions.Item>
          <Descriptions.Item label="Quận / Huyện">{customer.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ chi tiết">{customer.addressDetail || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ đầy đủ">{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{customer.note || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}

