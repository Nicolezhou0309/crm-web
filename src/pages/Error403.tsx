import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Error403() {
  const navigate = useNavigate();
  return (
    <Result
      status="403"
      title="403 无权限访问"
      subTitle="您没有权限访问该页面"
      extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
    />
  );
} 