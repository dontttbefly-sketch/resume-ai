/* 岗位视图：分析一份 JD / 浏览岗位池 */

import { useUiStore } from "../../store/useUiStore";
import { Segmented } from "../kit/Segmented";
import { AnalyzePane } from "./AnalyzePane";
import { PoolPane } from "./PoolPane";

export function MatchView() {
  const tab = useUiStore((s) => s.matchTab);
  const setTab = useUiStore((s) => s.setMatchTab);

  return (
    <div className="thin-scroll absolute inset-0 overflow-y-auto px-6 pb-12 pt-[100px]">
      <div className="mx-auto max-w-[1360px] space-y-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-fg">岗位</p>
            <p className="mt-2.5 text-[13px] text-fg-3">拿当前简历去比 JD：缺什么、怎么打招呼</p>
          </div>
          <Segmented
            className="ml-auto"
            value={tab}
            onChange={setTab}
            options={[
              { value: "analyze", label: "分析 JD" },
              { value: "pool", label: "岗位池" },
            ]}
          />
        </div>
        <div key={tab} className="anim-rise">
          {tab === "analyze" ? <AnalyzePane /> : <PoolPane />}
        </div>
      </div>
    </div>
  );
}
