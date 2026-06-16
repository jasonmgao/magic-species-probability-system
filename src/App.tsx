/**
 * 主应用组件
 */

import { useState } from 'react';
import { Layout, Menu, Typography, Space } from 'antd';
import { CardSelection } from './pages/CardSelection';
import { ProbabilityConfig } from './pages/ProbabilityConfig';
import {
  CalculatorOutlined,
  BookOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

type PageType = 'selection' | 'config';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('selection');

  const menuItems = [
    {
      key: 'selection',
      icon: <CalculatorOutlined />,
      label: '卡面选择',
    },
    {
      key: 'config',
      icon: <BookOutlined />,
      label: '使用教程',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 头部 */}
      <Header style={{ background: '#fff', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', maxWidth: 1400, margin: '0 auto' }}>
          <Title level={4} style={{ margin: 0, marginRight: 48 }}>
            🎴 神奇物种概率测算系统
          </Title>
          <Menu
            mode="horizontal"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key as PageType)}
            style={{ flex: 1, borderBottom: 'none' }}
          />
        </div>
      </Header>

      {/* 内容区 */}
      <Content style={{ background: '#f0f2f5', padding: 0 }}>
        {currentPage === 'selection' && (
          <CardSelection onNavigateToConfig={() => setCurrentPage('config')} />
        )}
        {currentPage === 'config' && (
          <ProbabilityConfig onNavigateToSelection={() => setCurrentPage('selection')} />
        )}
      </Content>

      {/* 底部 */}
      <Footer style={{ textAlign: 'center', background: '#fff' }}>
        <Space direction="vertical" size="small">
          <Text type="secondary">
            神奇物种概率配置自动化系统 v1.0
          </Text>
          <Text type="secondary">
            基于蒙特卡洛模拟的概率测算工具
          </Text>
        </Space>
      </Footer>
    </Layout>
  );
}

export default App;
