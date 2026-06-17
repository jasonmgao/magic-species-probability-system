/**
 * 主应用组件
 */

import { useState } from 'react';
import { Layout } from 'antd';
import { CardSelection } from './pages/CardSelection';
import { ProbabilityConfig } from './pages/ProbabilityConfig';

const { Content } = Layout;

type PageType = 'selection' | 'config';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('selection');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ background: '#f0f2f5', padding: 0 }}>
        {currentPage === 'selection' && (
          <CardSelection onNavigateToConfig={() => setCurrentPage('config')} />
        )}
        {currentPage === 'config' && (
          <ProbabilityConfig onNavigateToSelection={() => setCurrentPage('selection')} />
        )}
      </Content>
    </Layout>
  );
}

export default App;
