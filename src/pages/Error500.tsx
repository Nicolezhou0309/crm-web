import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Error500() {
  const navigate = useNavigate();
  return (
    <Result
      status="500"
      title="500 服务器错误"
      subTitle="服务器发生错误，请稍后重试"
      extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
    />
  );
} 