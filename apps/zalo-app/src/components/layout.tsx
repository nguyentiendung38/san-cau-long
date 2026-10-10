import { getSystemInfo } from "zmp-sdk";
import {
  AnimationRoutes,
  App,
  Route,
  SnackbarProvider,
  ZMPRouter,
} from "zmp-ui";
import { AppProps } from "zmp-ui/app";

import HomePage from "@/pages/index";
import ChatAIPage from "@/pages/chat-ai";
import HistoryPage from "@/pages/history";
import AvailabilityPage from "@/pages/availability";

const Layout = () => {
  return (
    <App theme={getSystemInfo().zaloTheme as AppProps["theme"]}>
      <SnackbarProvider>
        <ZMPRouter>
          <AnimationRoutes>
            <Route path="/" element={<HomePage />}></Route>
            <Route path="/chat-ai" element={<ChatAIPage />}></Route>
            <Route path="/history" element={<HistoryPage />}></Route>
            <Route path="/availability" element={<AvailabilityPage />}></Route>
          </AnimationRoutes>
        </ZMPRouter>
      </SnackbarProvider>
    </App>
  );
};
export default Layout;
