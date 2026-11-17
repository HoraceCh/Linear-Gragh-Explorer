import { useState } from "react";
import type { Graph } from "../model";
import {
  defaultMarkers,
  defaultProfile,
  validateProfile,
  type TeamProfile,
} from "../profiles/model";
export function ProfileEditor({
  value,
  graph,
  onSave,
  onClose,
}: {
  value: TeamProfile;
  graph: Graph;
  onSave: (p: TeamProfile) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(() => structuredClone(value)),
    [error, setError] = useState("");
  const policy = p.reviewPolicy || {
    enabled: false,
    requiredApprovals: 2,
    eligibleReviewerIds: [],
    excludeAssignee: true,
    inReviewStateIds: [],
    markers: defaultMarkers,
  };
  const update = (patch: Partial<typeof policy>) =>
    setP({ ...p, reviewPolicy: { ...policy, ...patch } });
  const save = () => {
    try {
      onSave(validateProfile(p, p.teamId));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const multi = (e: React.ChangeEvent<HTMLSelectElement>) =>
    [...e.target.selectedOptions].map((o) => o.value);
  return (
    <div className="modal-backdrop">
      <section
        className="modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label="团队配置"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="section-heading">
          <h2>团队配置 · {p.teamKey}</h2>
          <button className="button small" onClick={onClose}>
            关闭
          </button>
        </div>
        <p>
          仅保存在此浏览器。配置不会自动分享；导出文件含你选择的成员/标签
          ID，请妥善保存。
        </p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <h3>角色与分工</h3>
        <button
          className="button small"
          onClick={() =>
            setP({
              ...p,
              roles: [...p.roles, { id: crypto.randomUUID(), name: "新角色" }],
            })
          }
        >
          添加角色
        </button>
        {p.roles.map((r) => (
          <div className="settings-row" key={r.id}>
            <input
              aria-label="角色名称"
              value={r.name}
              onChange={(e) =>
                setP({
                  ...p,
                  roles: p.roles.map((x) =>
                    x.id === r.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <button
              onClick={() =>
                setP({
                  ...p,
                  roles: p.roles.filter((x) => x.id !== r.id),
                  memberRoleMap: Object.fromEntries(
                    Object.entries(p.memberRoleMap).map(([k, v]) => [
                      k,
                      v.filter((x) => x !== r.id),
                    ]),
                  ),
                })
              }
            >
              移除
            </button>
          </div>
        ))}
        {graph.members?.map((m) => (
          <label className="settings-row" key={m.id}>
            {m.name}
            <select
              multiple
              aria-label={`${m.name} 的角色`}
              value={p.memberRoleMap[m.id] || []}
              onChange={(e) =>
                setP({
                  ...p,
                  memberRoleMap: { ...p.memberRoleMap, [m.id]: multi(e) },
                })
              }
            >
              {p.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <h3>Workstream 映射</h3>
        {graph.labels?.map((l) => (
          <label className="settings-row" key={l.id}>
            {l.name}
            <input
              aria-label={`${l.name} 工作流`}
              placeholder="未映射"
              value={p.workstreamLabelMap[l.id] || ""}
              onChange={(e) =>
                setP({
                  ...p,
                  workstreamLabelMap: {
                    ...p.workstreamLabelMap,
                    [l.id]: e.target.value,
                  },
                })
              }
            />
          </label>
        ))}
        <label className="field">
          未映射任务的显示名称
          <input
            value={p.unmappedWorkstream}
            onChange={(e) => setP({ ...p, unmappedWorkstream: e.target.value })}
          />
        </label>
        <h3>只读审阅策略</h3>
        <label>
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          启用评论标记分析
        </label>
        <label className="field">
          需要的批准人数
          <input
            type="number"
            min={1}
            value={policy.requiredApprovals}
            onChange={(e) =>
              update({ requiredApprovals: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          有资格的审阅人（Ctrl / ⌘ 多选）
          <select
            multiple
            value={policy.eligibleReviewerIds}
            onChange={(e) => update({ eligibleReviewerIds: multi(e) })}
          >
            {graph.members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={policy.excludeAssignee}
            onChange={(e) => update({ excludeAssignee: e.target.checked })}
          />
          排除任务负责人
        </label>
        <label className="field">
          In Review 状态（按真实状态 ID 匹配）
          <select
            multiple
            value={policy.inReviewStateIds}
            onChange={(e) => update({ inReviewStateIds: multi(e) })}
          >
            {graph.states?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {(["approve", "requestChanges", "hold"] as const).map((k) => (
          <label className="field" key={k}>
            {k} 标记
            <input
              value={policy.markers[k]}
              onChange={(e) =>
                update({ markers: { ...policy.markers, [k]: e.target.value } })
              }
            />
          </label>
        ))}
        <p>
          本页只定义识别规则，不产生审批，也不修改 Linear
          状态。没有可靠的本轮状态历史时不会显示通过。
        </p>
        <div className="settings-buttons">
          <button className="button primary" onClick={save}>
            保存本地配置
          </button>
          <button
            className="button"
            onClick={() => {
              try {
                const safe = validateProfile(p, p.teamId);
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(safe, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "team-profile.json";
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            导出 JSON
          </button>
          <label className="button">
            导入 JSON
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) throw new Error("配置文件过大");
                  setP(
                    validateProfile(JSON.parse(await file.text()), p.teamId),
                  );
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </label>
          <button
            className="button"
            onClick={() => setP(defaultProfile(p.teamId, p.teamKey))}
          >
            恢复默认
          </button>
        </div>
      </section>
    </div>
  );
}
