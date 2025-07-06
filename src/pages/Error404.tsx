import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Error404() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404 页面未找到"
      subTitle="您访问的页面不存在"
      extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
    />
  );
} 