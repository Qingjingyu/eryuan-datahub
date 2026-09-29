import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingState } from '@/components/data/States'
import { getStoredUser } from '@/services/datahub-api'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((module) => ({ default: module.OverviewPage })))
const DataCatalogPage = lazy(() => import('@/pages/DataCatalogPage').then((module) => ({ default: module.DataCatalogPage })))
const AssetDetailPage = lazy(() => import('@/pages/AssetDetailPage').then((module) => ({ default: module.AssetDetailPage })))
const RawDataPage = lazy(() => import('@/pages/RawDataPage').then((module) => ({ default: module.RawDataPage })))
const ProcessingPage = lazy(() => import('@/pages/ProcessingPage').then((module) => ({ default: module.ProcessingPage })))
const ReviewCenterPage = lazy(() => import('@/pages/ReviewCenterPage').then((module) => ({ default: module.ReviewCenterPage })))
const KnowledgeServicePage = lazy(() => import('@/pages/KnowledgeServicePage').then((module) => ({ default: module.KnowledgeServicePage })))
const ProcessedDataPage = lazy(() => import('@/pages/ProcessedDataPage').then((module) => ({ default: module.ProcessedDataPage })))
const SearchPage = lazy(() => import('@/pages/SearchPage').then((module) => ({ default: module.SearchPage })))
const AgentAssistantPage = lazy(() => import('@/pages/AgentAssistantPage').then((module) => ({ default: module.AgentAssistantPage })))
const KnowledgeGraphPage = lazy(() => import('@/pages/KnowledgeGraphPage').then((module) => ({ default: module.KnowledgeGraphPage })))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ZhuangzhouOperationsPage = lazy(() => import('@/pages/ZhuangzhouOperationsPage').then((module) => ({ default: module.ZhuangzhouOperationsPage })))
const AboutPage = lazy(() => import('@/pages/AboutPage').then((module) => ({ default: module.AboutPage })))

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getStoredUser()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RouteLoader() {
  return <div className="p-2"><LoadingState label="模块加载中" rows={3} /></div>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/catalog" element={<DataCatalogPage />} />
          <Route path="/catalog/:assetId" element={<AssetDetailPage />} />
          <Route path="/raw" element={<RawDataPage />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/review" element={<ReviewCenterPage />} />
          <Route path="/knowledge-service" element={<KnowledgeServicePage />} />
          <Route path="/processed-data" element={<ProcessedDataPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/agent" element={<AgentAssistantPage />} />
          <Route path="/graph" element={<KnowledgeGraphPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/operations" element={<ZhuangzhouOperationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
