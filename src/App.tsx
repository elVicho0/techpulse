import { Routes, Route } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { OverviewView } from "@/views/Overview";
import { RepositoriesView } from "@/views/Repositories";
import { RepositoryDetailView } from "@/views/RepositoryDetail";
import { NewsView } from "@/views/News";
import { IdeasView } from "@/views/Ideas";
import { SavedView } from "@/views/Saved";
import { SettingsView } from "@/views/Settings";
import { IdeaDetailView } from "@/views/IdeaDetail";
import { NotFoundView } from "@/views/NotFound";
import { AppStateProvider } from "@/state/AppState";
import { ToastProvider } from "@/components/ui/Toast";
import { OverviewProvider } from "@/state/OverviewState";

export function App() {
  return (
    <AppStateProvider>
      <ToastProvider>
        <OverviewProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<OverviewView />} />
              <Route path="repositories" element={<RepositoriesView scope="all" />} />
              <Route path="ai-radar" element={<RepositoriesView scope="ai" />} />
              <Route path="data" element={<RepositoriesView scope="data" />} />
              <Route path="repo/:id" element={<RepositoryDetailView />} />
              <Route path="news" element={<NewsView />} />
              <Route path="ideas" element={<IdeasView />} />
              <Route path="ideas/:id" element={<IdeaDetailView />} />
              <Route path="saved" element={<SavedView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="*" element={<NotFoundView />} />
            </Route>
          </Routes>
        </OverviewProvider>
      </ToastProvider>
    </AppStateProvider>
  );
}
