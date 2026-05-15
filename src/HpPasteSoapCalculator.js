import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import soapOils from "./json/soap.json";
import "./CpSoapCalculator.css";

/** 완제품(페이스트) 목표 무게 */
const BATCH_SOAP_TARGET_G = 600;
/** 오일 합이 없을 때 설탕액 ml 권장구간에 쓰는 기준 오일량(기본 배합 근사) */
const FALLBACK_OIL_MASS_G = Math.round(335 * (BATCH_SOAP_TARGET_G / 500));
/** 추정 총량 vs 목표 비교 시 허용 오차(g) */
const BATCH_MATCH_TOLERANCE_G = 14;

const MANDATORY_OIL_EN = ["Palm oil", "Coconut oil"];
const MIN_PALM_PLUS_COCONUT_PCT = 50;
const MAX_COCONUT_PCT = 30;
const RATIO_EPS = 0.08;

function totalOilGramsFromRows(rows) {
  return rows.reduce((s, r) => s + (Number(r.grams) || 0), 0);
}

function gramsByOilEn(rows, oilNameEn) {
  return rows.reduce((s, r) => {
    if (r.oil?.oil_name_en === oilNameEn) return s + (Number(r.grams) || 0);
    return s;
  }, 0);
}

function getOilRatioStatus(rows) {
  const t = totalOilGramsFromRows(rows);
  const palm = gramsByOilEn(rows, "Palm oil");
  const coco = gramsByOilEn(rows, "Coconut oil");
  const palmCocoPct = t > 0 ? ((palm + coco) / t) * 100 : 0;
  const cocoPct = t > 0 ? (coco / t) * 100 : 0;
  if (t <= 0) {
    return {
      ok: true,
      palmCocoPct,
      cocoPct,
      palmCocoTooLow: false,
      cocoTooHigh: false,
    };
  }
  const palmCocoTooLow = palmCocoPct < MIN_PALM_PLUS_COCONUT_PCT - RATIO_EPS;
  const cocoTooHigh = cocoPct > MAX_COCONUT_PCT + RATIO_EPS;
  return {
    ok: !palmCocoTooLow && !cocoTooHigh,
    palmCocoPct,
    cocoPct,
    palmCocoTooLow,
    cocoTooHigh,
  };
}

function sortOilsKo(list) {
  return [...list].sort((a, b) =>
    a.oil_name_ko.localeCompare(b.oil_name_ko, "ko")
  );
}

function rowsHaveMandatoryOils(rows) {
  const present = new Set(
    rows.map((r) => r.oil?.oil_name_en).filter(Boolean)
  );
  return MANDATORY_OIL_EN.every((en) => present.has(en));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** CP 500g 기준 기본 오일을 600g 배치에 맞게 스케일 */
function createDefaultOilRows() {
  const scale = BATCH_SOAP_TARGET_G / 500;
  const sorted = sortOilsKo(soapOils);
  const idx = (en) => sorted.findIndex((o) => o.oil_name_en === en);
  const palmI = idx("Palm oil");
  const oliveI = idx("Olive oil");
  const coconutI = idx("Coconut oil");
  if (palmI < 0 || oliveI < 0 || coconutI < 0) return [];
  const specs = [
    { oilIndex: palmI, grams: Math.round(135 * scale) },
    { oilIndex: coconutI, grams: Math.round(100 * scale) },
    { oilIndex: oliveI, grams: Math.round(100 * scale) },
  ];
  return specs.map((s) => ({
    id: uid(),
    oilIndex: s.oilIndex,
    oil: sorted[s.oilIndex],
    grams: s.grams,
  }));
}

/** 설탕액: 오일 대비 부피 권장(페이스트용, 대략 가이드) */
function sugarMlBoundsForOilMass(oilMassG) {
  const mass = oilMassG > 0 ? oilMassG : FALLBACK_OIL_MASS_G;
  return {
    minMl: Math.round(mass * 0.08 * 10) / 10,
    maxMl: Math.round(mass * 0.45 * 10) / 10,
    targetMl: Math.round(mass * 0.22 * 10) / 10,
  };
}

function isSugarMlOutOfRange(ml, oilMassG) {
  const { minMl, maxMl } = sugarMlBoundsForOilMass(oilMassG);
  const v = Number(ml);
  if (Number.isNaN(v)) return true;
  return v < minMl - 0.001 || v > maxMl + 0.001;
}

const LYE_DISCOUNT_MIN = 0;
const LYE_DISCOUNT_MAX = 15;
const LYE_DISCOUNT_DEFAULT = 5;

const WATER_PCT_MIN = 30;
const WATER_PCT_MAX = 45;
const WATER_PCT_DEFAULT = 35;

const SUGAR_PRESETS = [
  "설탕:물 1:1 (중량비)",
  "설탕:물 1:1.5",
  "설탕:물 1:2",
  "꿀·물 시럽",
  "기타 (직접 입력)",
];

function HpPasteSoapCalculator() {
  const sortedOils = useMemo(() => sortOilsKo(soapOils), []);

  const generatedAtLabel = useMemo(
    () =>
      new Date().toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const [oilRows, setOilRows] = useState(createDefaultOilRows);
  const [lyeDiscountPct, setLyeDiscountPct] = useState(LYE_DISCOUNT_DEFAULT);
  const [waterPct, setWaterPct] = useState(WATER_PCT_DEFAULT);
  const [sugarRows, setSugarRows] = useState([]);

  useEffect(() => {
    document.body.classList.add("cp-soap-body");
    return () => document.body.classList.remove("cp-soap-body");
  }, []);

  const totalOilG = useMemo(
    () => oilRows.reduce((s, r) => s + (Number(r.grams) || 0), 0),
    [oilRows]
  );

  const totalOilGRef = useRef(totalOilG);
  useEffect(() => {
    totalOilGRef.current = totalOilG;
  }, [totalOilG]);

  const oilMassForPct =
    totalOilG > 0 ? totalOilG : FALLBACK_OIL_MASS_G;
  const sugarTargetMl = Math.round(oilMassForPct * 0.22 * 10) / 10;
  const sugarMlMin = Math.round(oilMassForPct * 0.08 * 10) / 10;
  const sugarMlMax = Math.round(oilMassForPct * 0.45 * 10) / 10;

  const theoreticalKoh = useMemo(() => {
    return oilRows.reduce((sum, row) => {
      const oil = row.oil;
      const g = Number(row.grams) || 0;
      if (!oil || g <= 0) return sum;
      const k = Number(oil.koh);
      if (Number.isNaN(k)) return sum;
      return sum + g * k;
    }, 0);
  }, [oilRows]);

  const kohG = useMemo(() => {
    const factor = 1 - lyeDiscountPct / 100;
    return theoreticalKoh * factor;
  }, [theoreticalKoh, lyeDiscountPct]);

  const distilledWaterMl = useMemo(() => {
    return totalOilG * (waterPct / 100);
  }, [totalOilG, waterPct]);

  const sugarSolutionTotalMl = useMemo(
    () => sugarRows.reduce((s, r) => s + (Number(r.ml) || 0), 0),
    [sugarRows]
  );

  const estimatedBatchG = useMemo(
    () =>
      totalOilG +
      kohG +
      distilledWaterMl +
      sugarSolutionTotalMl,
    [totalOilG, kohG, distilledWaterMl, sugarSolutionTotalMl]
  );

  const oilRatioStatus = useMemo(() => getOilRatioStatus(oilRows), [oilRows]);

  const addOilRow = useCallback(() => {
    const first = sortedOils[0];
    setOilRows((prev) => [
      ...prev,
      {
        id: uid(),
        oilIndex: 0,
        oil: first,
        grams: 0,
      },
    ]);
  }, [sortedOils]);

  const updateOilRow = useCallback(
    (id, patch) => {
      setOilRows((prev) => {
        const draft = prev.map((row) => {
          if (row.id !== id) return row;
          const next = { ...row, ...patch };
          if (patch.oilIndex !== undefined) {
            const oil = sortedOils[patch.oilIndex];
            next.oil = oil;
            next.oilIndex = patch.oilIndex;
          }
          if (patch.grams !== undefined) {
            if (patch.grams === "") {
              next.grams = "";
            } else {
              const g = Number(patch.grams);
              if (!Number.isNaN(g)) {
                next.grams = g;
              }
            }
          }
          return next;
        });
        if (patch.oilIndex !== undefined && !rowsHaveMandatoryOils(draft)) {
          return prev;
        }
        return draft;
      });
    },
    [sortedOils]
  );

  const removeOilRow = useCallback((id) => {
    setOilRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (!rowsHaveMandatoryOils(next)) {
        return prev;
      }
      return next;
    });
  }, []);

  const addSugarRow = useCallback(() => {
    const mass =
      totalOilGRef.current > 0 ? totalOilGRef.current : FALLBACK_OIL_MASS_G;
    const defaultMl = Math.round(mass * 0.22 * 10) / 10;
    setSugarRows((prev) => [
      ...prev,
      {
        id: uid(),
        presetIndex: 0,
        name: SUGAR_PRESETS[0],
        ml: defaultMl,
      },
    ]);
  }, []);

  const updateSugarRow = useCallback((id, patch) => {
    setSugarRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.presetIndex !== undefined) {
          next.name = SUGAR_PRESETS[patch.presetIndex];
        }
        if (patch.ml !== undefined) {
          const v = Number(patch.ml);
          if (!Number.isNaN(v)) {
            next.ml = Math.round(v * 10) / 10;
          }
        }
        return next;
      })
    );
  }, []);

  const removeSugarRow = useCallback((id) => {
    setSugarRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetBatch = useCallback(() => {
    if (
      !window.confirm(
        "배합을 기본값으로 초기화할까요? 오일·가성가리·증류수·설탕액 입력이 모두 처음 상태로 돌아갑니다."
      )
    ) {
      return;
    }
    setOilRows(createDefaultOilRows());
    setLyeDiscountPct(LYE_DISCOUNT_DEFAULT);
    setWaterPct(WATER_PCT_DEFAULT);
    setSugarRows([]);
  }, []);

  const allowDeleteOilRow = useCallback(
    (id) => rowsHaveMandatoryOils(oilRows.filter((r) => r.id !== id)),
    [oilRows]
  );

  return (
    <div className="cp-soap cp-soap--worksheet">
      <div className="cp-soap__actions cp-soap__screen-only">
        <div className="cp-soap__actions-left">
          <Link className="cp-soap__link" to="/">
            ← 뮤직 플레이어
          </Link>
          <Link className="cp-soap__link" to="/soap">
            CP 비누 배합표 →
          </Link>
        </div>
        <div className="cp-soap__actions-right">
          <button
            type="button"
            className="cp-soap__btn"
            onClick={resetBatch}
          >
            배합 초기화
          </button>
          <button
            type="button"
            className="cp-soap__btn cp-soap__btn--primary"
            onClick={() => window.print()}
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      <header className="cp-soap__header">
        <div className="cp-soap__print-only cp-soap__print-ribbon">
          HP 천연물비누 페이스트 · 배합 기록표 · 완성 목표 {BATCH_SOAP_TARGET_G} g
        </div>
        <h1 className="cp-soap__title">
          HP 천연물비누 페이스트 배합 (완성 {BATCH_SOAP_TARGET_G} g)
        </h1>
        <p className="cp-soap__hint cp-soap__screen-only">
          가성소다(NaOH) 대신 <strong>가성가리(KOH)</strong> 기준으로 계산합니다. 첨가물
          대신 <strong>설탕액</strong>만 입력합니다.
        </p>

        <p className="cp-soap__meta-line cp-soap__print-only">
          기록 일시: {generatedAtLabel}
        </p>
      </header>

      <section className="cp-soap__card">
        <h2 className="cp-soap__h2">베이스 오일</h2>

        {totalOilG > 0 && (
          <div
            className="cp-soap__ratio-guides cp-soap__screen-only"
            aria-live="polite"
          >
            {oilRatioStatus.palmCocoTooLow && (
              <p className="cp-soap__ratio-guide cp-soap__ratio-guide--palmco">
                팜유+코코넛 합이 전체 오일의 {MIN_PALM_PLUS_COCONUT_PCT}% 미만입니다. 현재
                약 {oilRatioStatus.palmCocoPct.toFixed(1)}%.
              </p>
            )}
            {oilRatioStatus.cocoTooHigh && (
              <p className="cp-soap__ratio-guide cp-soap__ratio-guide--coconut">
                코코넛이 전체 오일의 {MAX_COCONUT_PCT}%를 넘었습니다. 현재 약{" "}
                {oilRatioStatus.cocoPct.toFixed(1)}%.
              </p>
            )}
          </div>
        )}
        <div className="cp-soap__toolbar cp-soap__screen-only">
          <button type="button" className="cp-soap__btn" onClick={addOilRow}>
            + 오일 행 추가
          </button>
          <span className="cp-soap__total">
            오일 합계: <strong>{totalOilG.toFixed(1)}</strong> g
            {totalOilG > 0 && (
              <>
                {" "}
                · 팜+코{" "}
                <strong
                  className={
                    oilRatioStatus.palmCocoTooLow
                      ? "cp-soap__stat--warn"
                      : undefined
                  }
                >
                  {oilRatioStatus.palmCocoPct.toFixed(1)}
                </strong>
                %(≥{MIN_PALM_PLUS_COCONUT_PCT}%) · 코코넛{" "}
                <strong
                  className={
                    oilRatioStatus.cocoTooHigh
                      ? "cp-soap__stat--coconut-warn"
                      : undefined
                  }
                >
                  {oilRatioStatus.cocoPct.toFixed(1)}
                </strong>
                %(≤{MAX_COCONUT_PCT}%)
              </>
            )}
          </span>
        </div>
        <div className="cp-soap__toolbar cp-soap__screen-only">
          <span className="cp-soap__total">
            추정 완성 총량: <strong>{estimatedBatchG.toFixed(1)}</strong> g / 목표{" "}
            {BATCH_SOAP_TARGET_G}g
            {Math.abs(estimatedBatchG - BATCH_SOAP_TARGET_G) >
              BATCH_MATCH_TOLERANCE_G && (
              <span className="cp-soap__warn"> (목표와 다름)</span>
            )}
          </span>
        </div>
        <p className="cp-soap__print-only cp-soap__print-summary-line">
          오일 합계: {totalOilG.toFixed(1)} g
          {totalOilG > 0 && (
            <>
              {" "}
              · 팜+코 {oilRatioStatus.palmCocoPct.toFixed(1)}% · 코코넛{" "}
              {oilRatioStatus.cocoPct.toFixed(1)}%
            </>
          )}{" "}
          · 추정 완성 총량: {estimatedBatchG.toFixed(1)} g
        </p>
        <div className="cp-soap__table-wrap">
          <table className="cp-soap__table">
            <thead>
              <tr>
                <th>오일</th>
                <th>용량 (g)</th>
                <th>KOH/g</th>
                <th className="cp-soap__screen-only">편집</th>
              </tr>
            </thead>
            <tbody>
              {oilRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="cp-soap__empty">
                    <span className="cp-soap__screen-only">
                      「+ 오일 행 추가」로 베이스 오일을 추가하세요.
                    </span>
                    <span className="cp-soap__print-only">(오일 없음)</span>
                  </td>
                </tr>
              )}
              {oilRows.map((row) => {
                const isCoconutRow =
                  row.oil?.oil_name_en === "Coconut oil" &&
                  oilRatioStatus.cocoTooHigh;
                const trClass = [isCoconutRow ? "cp-soap__tr--coco-warn" : ""]
                  .filter(Boolean)
                  .join(" ");
                const kohVal = row.oil?.koh;
                return (
                  <tr key={row.id} className={trClass || undefined}>
                    <td>
                      <span className="cp-soap__print-only cp-soap__print-line">
                        {row.oil.oil_name_ko} ({row.oil.oil_name_en})
                      </span>
                      <select
                        className="cp-soap__select cp-soap__screen-only"
                        value={row.oilIndex}
                        onChange={(e) =>
                          updateOilRow(row.id, {
                            oilIndex: Number(e.target.value),
                          })
                        }
                      >
                        {sortedOils.map((o, idx) => (
                          <option key={o.oil_name_en + idx} value={idx}>
                            {o.oil_name_ko} ({o.oil_name_en})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="cp-soap__print-only cp-soap__print-line">
                        {row.grams === ""
                          ? "—"
                          : `${Number(row.grams) || 0} g`}
                      </span>
                      <input
                        type="number"
                        className={
                          "cp-soap__input cp-soap__screen-only" +
                          (isCoconutRow ? " cp-soap__input--coco-warn" : "")
                        }
                        step={1}
                        value={row.grams === "" ? "" : row.grams}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateOilRow(row.id, { grams: "" });
                            return;
                          }
                          updateOilRow(row.id, { grams: Number(v) });
                        }}
                      />
                    </td>
                    <td
                      className={
                        isCoconutRow ? "cp-soap__td--coco-warn" : undefined
                      }
                    >
                      {kohVal != null && !Number.isNaN(Number(kohVal))
                        ? Number(kohVal).toFixed(3)
                        : "—"}
                    </td>
                    <td className="cp-soap__screen-only">
                      <button
                        type="button"
                        className="cp-soap__btn cp-soap__btn--ghost"
                        disabled={!allowDeleteOilRow(row.id)}
                        title={
                          !allowDeleteOilRow(row.id)
                            ? "팜유·코코넛은 각각 한 행 이상 필요합니다"
                            : undefined
                        }
                        onClick={() => removeOilRow(row.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cp-soap__card">
        <h2 className="cp-soap__h2">가성가리 (KOH) · 증류수</h2>
        <div className="cp-soap__screen-only cp-soap__grid">
          <label className="cp-soap__field">
            <span>
              알칼리 디스카운트 ({LYE_DISCOUNT_MIN}~{LYE_DISCOUNT_MAX}%, 기본{" "}
              {LYE_DISCOUNT_DEFAULT}%)
            </span>
            <div className="cp-soap__slider-row">
              <input
                type="range"
                min={LYE_DISCOUNT_MIN}
                max={LYE_DISCOUNT_MAX}
                step={1}
                value={lyeDiscountPct}
                onChange={(e) => setLyeDiscountPct(Number(e.target.value))}
              />
              <span className="cp-soap__slider-val">{lyeDiscountPct}%</span>
            </div>
          </label>
          <label className="cp-soap__field">
            <span>
              증류수 비율 (오일 대비 {WATER_PCT_MIN}~{WATER_PCT_MAX}%, 기본{" "}
              {WATER_PCT_DEFAULT}%)
            </span>
            <div className="cp-soap__slider-row">
              <input
                type="range"
                min={WATER_PCT_MIN}
                max={WATER_PCT_MAX}
                step={1}
                value={waterPct}
                onChange={(e) => setWaterPct(Number(e.target.value))}
              />
              <span className="cp-soap__slider-val">{waterPct}%</span>
            </div>
          </label>
        </div>
        <ul className="cp-soap__print-only cp-soap__print-param-list">
          <li>알칼리 디스카운트: {lyeDiscountPct}%</li>
          <li>증류수 비율 (오일 대비): {waterPct}%</li>
        </ul>
        <dl className="cp-soap__dl">
          <div>
            <dt>가성가리 합 (디스카운트 전)</dt>
            <dd>{theoreticalKoh.toFixed(2)} g</dd>
          </div>
          <div>
            <dt>가성가리 자동량 (디스카운트 적용)</dt>
            <dd className="cp-soap__highlight">{kohG.toFixed(2)} g</dd>
          </div>
          <div>
            <dt>증류수 (용해용) 자동량</dt>
            <dd className="cp-soap__highlight">
              {distilledWaterMl.toFixed(1)} ml
            </dd>
          </div>
        </dl>
      </section>

      <section className="cp-soap__card">
        <h2 className="cp-soap__h2">설탕액</h2>
        <p className="cp-soap__hint cp-soap__screen-only">
          오일 합계 기준 대략 <strong>8~45%</strong> 부피(ml)를 안내합니다(권장 약{" "}
          <strong>22%</strong>, {sugarTargetMl}ml). ml은 완성 추정 시 g과 동일하게
          합산합니다(근사).
        </p>
        {sugarRows.some((r) => isSugarMlOutOfRange(r.ml, totalOilG)) && (
          <div
            className="cp-soap__ratio-guides cp-soap__screen-only"
            aria-live="polite"
          >
            <p className="cp-soap__ratio-guide cp-soap__ratio-guide--coconut">
              설탕액은 오일 합계 기준 약 {sugarMlMin}~{sugarMlMax}ml(권장 약{" "}
              {sugarTargetMl}ml) 구간을 참고해 주세요.
            </p>
          </div>
        )}
        <div className="cp-soap__toolbar cp-soap__screen-only">
          <button type="button" className="cp-soap__btn" onClick={addSugarRow}>
            + 설탕액 행 추가
          </button>
        </div>
        <div className="cp-soap__table-wrap">
          <table className="cp-soap__table">
            <thead>
              <tr>
                <th>종류</th>
                <th>명칭</th>
                <th>양 (ml)</th>
                <th className="cp-soap__screen-only">편집</th>
              </tr>
            </thead>
            <tbody>
              {sugarRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="cp-soap__empty">
                    <span className="cp-soap__screen-only">
                      설탕액 행을 추가하세요.
                    </span>
                    <span className="cp-soap__print-only">(설탕액 없음)</span>
                  </td>
                </tr>
              )}
              {sugarRows.map((row) => {
                const sugarInvalid = isSugarMlOutOfRange(row.ml, totalOilG);
                return (
                  <tr
                    key={row.id}
                    className={
                      sugarInvalid ? "cp-soap__tr--additive-warn" : undefined
                    }
                  >
                    <td>설탕액</td>
                    <td>
                      <span className="cp-soap__print-only cp-soap__print-line">
                        {row.name}
                      </span>
                      <select
                        className="cp-soap__select cp-soap__screen-only"
                        value={row.presetIndex}
                        onChange={(e) =>
                          updateSugarRow(row.id, {
                            presetIndex: Number(e.target.value),
                          })
                        }
                      >
                        {SUGAR_PRESETS.map((p, idx) => (
                          <option key={p} value={idx}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="cp-soap__print-only cp-soap__print-line">
                        {row.ml} ml
                      </span>
                      <input
                        type="number"
                        className={
                          "cp-soap__input cp-soap__screen-only" +
                          (sugarInvalid ? " cp-soap__input--coco-warn" : "")
                        }
                        step={0.1}
                        value={row.ml}
                        onChange={(e) =>
                          updateSugarRow(row.id, {
                            ml: Number(e.target.value),
                          })
                        }
                      />
                      <span className="cp-soap__unit cp-soap__screen-only">
                        ml
                      </span>
                    </td>
                    <td className="cp-soap__screen-only">
                      <button
                        type="button"
                        className="cp-soap__btn cp-soap__btn--ghost"
                        onClick={() => removeSugarRow(row.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="cp-soap__footer cp-soap__print-only">
        <p>
          본 표는 계산 보조용입니다. 가성가리(KOH)·설탕액은 안전 수칙을 지키고, 최종
          사용 전 별도 검증을 권장합니다.
        </p>
      </footer>
    </div>
  );
}

export default HpPasteSoapCalculator;
