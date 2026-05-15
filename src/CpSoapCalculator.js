import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import soapOils from "./json/soap.json";
import "./CpSoapCalculator.css";

/** 완제품(배치) 기준 목표 무게 — 오일 합 500g이 아님 */
const BATCH_SOAP_TARGET_G = 500;
/** 오일 합이 없을 때 EO% 등에 쓰는 기준 오일량(기본 배합 근사) */
const FALLBACK_OIL_MASS_G = 335;
/** 추정 비누 총량 vs 목표 비교 시 허용 오차(g) */
const BATCH_MATCH_TOLERANCE_G = 12;

/** 팜·코코넛은 배합에 필수(행). 올리브는 선택. 비율은 전체 오일 무게 기준. */
const MANDATORY_OIL_EN = ["Palm oil", "Coconut oil"];

/** 전체 오일 대비 팜+코코넛 합 최소 비율(%): 고체 유지 마지노선 */
const MIN_PALM_PLUS_COCONUT_PCT = 50;
/** 전체 오일 대비 코코넛 최대 비율(%): 세정 과다·건조 완화 */
const MAX_COCONUT_PCT = 30;
/** 비율 비교 시 부동소수 허용 오차(%p) */
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

/**
 * @returns {{
 *   ok: boolean,
 *   palmCocoPct: number,
 *   cocoPct: number,
 *   palmCocoTooLow: boolean,
 *   cocoTooHigh: boolean,
 * }}
 */
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

/** 초기: 팜·코코넛(필수)+올리브(선택). 비율 만족 + 오일 합 ≈335g */
function createDefaultOilRows() {
  const sorted = sortOilsKo(soapOils);
  const idx = (en) => sorted.findIndex((o) => o.oil_name_en === en);
  const palmI = idx("Palm oil");
  const oliveI = idx("Olive oil");
  const coconutI = idx("Coconut oil");
  if (palmI < 0 || oliveI < 0 || coconutI < 0) return [];
  const specs = [
    { oilIndex: palmI, grams: 135 },
    { oilIndex: coconutI, grams: 100 },
    { oilIndex: oliveI, grams: 100 },
  ];
  return specs.map((s) => ({
    id: uid(),
    oilIndex: s.oilIndex,
    oil: sorted[s.oilIndex],
    grams: s.grams,
  }));
}

const POWDER_G_MIN = 10;
const POWDER_G_MAX = 30;

function eoMlBoundsForOilMass(oilMassG) {
  const mass = oilMassG > 0 ? oilMassG : FALLBACK_OIL_MASS_G;
  return {
    minMl: Math.round(mass * 0.005 * 10) / 10,
    maxMl: Math.round(mass * 0.015 * 10) / 10,
    targetMl: Math.round(mass * 0.01 * 10) / 10,
  };
}

function isPowderGramsOutOfRange(grams) {
  if (grams === "") return true;
  const g = Number(grams);
  if (Number.isNaN(g)) return true;
  return g < POWDER_G_MIN || g > POWDER_G_MAX;
}

function isEoMlOutOfRange(ml, oilMassG) {
  const { minMl, maxMl } = eoMlBoundsForOilMass(oilMassG);
  const v = Number(ml);
  if (Number.isNaN(v)) return true;
  return v < minMl - 0.001 || v > maxMl + 0.001;
}

const LYE_DISCOUNT_MIN = 0;
const LYE_DISCOUNT_MAX = 15;
const LYE_DISCOUNT_DEFAULT = 5;

const WATER_PCT_MIN = 30;
const WATER_PCT_MAX = 45;
const WATER_PCT_DEFAULT = 33;

const POWDER_PRESETS = [
  "칼라민",
  "카올린 클레이",
  "벤토나이트",
  "활성탄",
  "귀리 가루",
  "팥 가루",
  "녹차 가루",
  "코코아 파우더",
  "우유 분말",
  "실크 파우더",
  "기타 (직접 입력)",
];

const EO_PRESETS = [
  "라벤더",
  "레몬그라스",
  "페퍼민트",
  "티트리",
  "유칼립투스",
  "로즈마리",
  "베르가못",
  "기타 (직접 입력)",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function CpSoapCalculator() {
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
  const [additiveRows, setAdditiveRows] = useState([]);

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
  const eoTargetMl = Math.round(oilMassForPct * 0.01 * 10) / 10;
  const eoMlMin = Math.round(oilMassForPct * 0.005 * 10) / 10;
  const eoMlMax = Math.round(oilMassForPct * 0.015 * 10) / 10;

  const theoreticalNaoh = useMemo(() => {
    return oilRows.reduce((sum, row) => {
      const oil = row.oil;
      const g = Number(row.grams) || 0;
      if (!oil || g <= 0) return sum;
      return sum + g * oil.naoh;
    }, 0);
  }, [oilRows]);

  const naohG = useMemo(() => {
    const factor = 1 - lyeDiscountPct / 100;
    return theoreticalNaoh * factor;
  }, [theoreticalNaoh, lyeDiscountPct]);

  const distilledWaterMl = useMemo(() => {
    return totalOilG * (waterPct / 100);
  }, [totalOilG, waterPct]);

  const additivePowderTotalG = useMemo(
    () =>
      additiveRows
        .filter((r) => r.kind === "powder")
        .reduce((s, r) => s + (Number(r.grams) || 0), 0),
    [additiveRows]
  );

  const additiveEoTotalMl = useMemo(
    () =>
      additiveRows
        .filter((r) => r.kind === "eo")
        .reduce((s, r) => s + (Number(r.ml) || 0), 0),
    [additiveRows]
  );

  const estimatedSoapBatchG = useMemo(
    () =>
      totalOilG +
      naohG +
      distilledWaterMl +
      additivePowderTotalG +
      additiveEoTotalMl,
    [
      totalOilG,
      naohG,
      distilledWaterMl,
      additivePowderTotalG,
      additiveEoTotalMl,
    ]
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

  const addAdditiveRow = useCallback((kind) => {
    if (kind === "powder") {
      setAdditiveRows((prev) => [
        ...prev,
        {
          id: uid(),
          kind: "powder",
          presetIndex: 0,
          name: POWDER_PRESETS[0],
          grams: 15,
        },
      ]);
    } else {
      const mass = totalOilGRef.current > 0 ? totalOilGRef.current : FALLBACK_OIL_MASS_G;
      const defaultMl = Math.round(mass * 0.01 * 10) / 10;
      setAdditiveRows((prev) => [
        ...prev,
        {
          id: uid(),
          kind: "eo",
          presetIndex: 0,
          name: EO_PRESETS[0],
          ml: defaultMl,
        },
      ]);
    }
  }, []);

  const updateAdditiveRow = useCallback((id, patch) => {
    setAdditiveRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.presetIndex !== undefined && row.kind === "powder") {
          next.name = POWDER_PRESETS[patch.presetIndex];
        }
        if (patch.presetIndex !== undefined && row.kind === "eo") {
          next.name = EO_PRESETS[patch.presetIndex];
        }
        if (patch.grams !== undefined && row.kind === "powder") {
          if (patch.grams === "") {
            next.grams = "";
          } else {
            const g = Number(patch.grams);
            if (!Number.isNaN(g)) {
              next.grams = g;
            }
          }
        }
        if (patch.ml !== undefined && row.kind === "eo") {
          const v = Number(patch.ml);
          if (!Number.isNaN(v)) {
            next.ml = Math.round(v * 10) / 10;
          }
        }
        return next;
      })
    );
  }, []);

  const removeAdditiveRow = useCallback((id) => {
    setAdditiveRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetBatch = useCallback(() => {
    if (
      !window.confirm(
        "배합을 기본값으로 초기화할까요? 오일·가성소다·증류수·첨가물 입력이 모두 처음 상태로 돌아갑니다."
      )
    ) {
      return;
    }
    setOilRows(createDefaultOilRows());
    setLyeDiscountPct(LYE_DISCOUNT_DEFAULT);
    setWaterPct(WATER_PCT_DEFAULT);
    setAdditiveRows([]);
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
          <Link className="cp-soap__link" to="/soap-hp">
            HP 페이스트 배합 →
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
          CP 비누 · 배합 기록표 · 완제품 비누 목표 {BATCH_SOAP_TARGET_G} g
        </div>
        <h1 className="cp-soap__title">
          CP 비누 배합 (완제품 비누 목표 {BATCH_SOAP_TARGET_G} g)
        </h1>

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
                팜유+코코넛 합이 전체 오일의 {MIN_PALM_PLUS_COCONUT_PCT}% 미만입니다(고체
                유지). 현재 약 {oilRatioStatus.palmCocoPct.toFixed(1)}%.
              </p>
            )}
            {oilRatioStatus.cocoTooHigh && (
              <p className="cp-soap__ratio-guide cp-soap__ratio-guide--coconut">
                코코넛이 전체 오일의 {MAX_COCONUT_PCT}%를 넘었습니다(세정 과다·건조). 현재
                약 {oilRatioStatus.cocoPct.toFixed(1)}%. 코코넛 g을 줄여 주세요.
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
            추정 비누 총량: <strong>{estimatedSoapBatchG.toFixed(1)}</strong> g / 목표{" "}
            {BATCH_SOAP_TARGET_G}g
            {Math.abs(estimatedSoapBatchG - BATCH_SOAP_TARGET_G) >
              BATCH_MATCH_TOLERANCE_G && (
              <span className="cp-soap__warn"> (비누 목표와 다름)</span>
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
          · 추정 비누 총량: {estimatedSoapBatchG.toFixed(1)} g
        </p>
        <div className="cp-soap__table-wrap">
          <table className="cp-soap__table">
            <thead>
              <tr>
                <th>오일</th>
                <th>용량 (g)</th>
                <th>비누화값</th>
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
                      {row.oil?.naoh != null
                        ? Number(row.oil.naoh).toFixed(3)
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
        <h2 className="cp-soap__h2">가성소다 (NaOH) · 증류수</h2>
        <div className="cp-soap__screen-only cp-soap__grid">
          <label className="cp-soap__field">
            <span>
              가성소다 디스카운트 ({LYE_DISCOUNT_MIN}~{LYE_DISCOUNT_MAX}%, 기본{" "}
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
          <li>가성소다 디스카운트: {lyeDiscountPct}%</li>
          <li>증류수 비율 (오일 대비): {waterPct}%</li>
        </ul>
        <dl className="cp-soap__dl">
          <div>
            <dt>가성소다 합 (디스카운트 전)</dt>
            <dd>{theoreticalNaoh.toFixed(2)} g</dd>
          </div>
          <div>
            <dt>가성소다 자동량 (디스카운트 적용)</dt>
            <dd className="cp-soap__highlight">{naohG.toFixed(2)} g</dd>
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
        <h2 className="cp-soap__h2">첨가물</h2>
        <p className="cp-soap__hint cp-soap__screen-only">
          분말: {POWDER_G_MIN}~{POWDER_G_MAX}g. 에센셜 오일: 오일 합계의 약 1% 권장(
          {eoTargetMl}ml, 허용 {eoMlMin}~{eoMlMax}ml)
        </p>
        {(additiveRows.some(
          (r) => r.kind === "powder" && isPowderGramsOutOfRange(r.grams)
        ) ||
          additiveRows.some(
            (r) => r.kind === "eo" && isEoMlOutOfRange(r.ml, totalOilG)
          )) && (
          <div
            className="cp-soap__ratio-guides cp-soap__screen-only"
            aria-live="polite"
          >
            {additiveRows.some(
              (r) => r.kind === "powder" && isPowderGramsOutOfRange(r.grams)
            ) && (
              <p className="cp-soap__ratio-guide cp-soap__ratio-guide--coconut">
                분말은 행마다 {POWDER_G_MIN}~{POWDER_G_MAX}g 사이로 맞춰 주세요.
              </p>
            )}
            {additiveRows.some(
              (r) => r.kind === "eo" && isEoMlOutOfRange(r.ml, totalOilG)
            ) && (
              <p className="cp-soap__ratio-guide cp-soap__ratio-guide--coconut">
                에센셜 오일은 오일 합계 기준 약 0.5~1.5% ({eoMlMin}~{eoMlMax}ml,
                권장 1% {eoTargetMl}ml)입니다.
              </p>
            )}
          </div>
        )}
        <div className="cp-soap__toolbar cp-soap__screen-only">
          <button
            type="button"
            className="cp-soap__btn"
            onClick={() => addAdditiveRow("powder")}
          >
            + 분말 행 추가
          </button>
          <button
            type="button"
            className="cp-soap__btn"
            onClick={() => addAdditiveRow("eo")}
          >
            + 에센셜 오일 행 추가
          </button>
        </div>
        <div className="cp-soap__table-wrap">
          <table className="cp-soap__table">
            <thead>
              <tr>
                <th>종류</th>
                <th>명칭</th>
                <th>양</th>
                <th className="cp-soap__screen-only">편집</th>
              </tr>
            </thead>
            <tbody>
              {additiveRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="cp-soap__empty">
                    <span className="cp-soap__screen-only">
                      분말 또는 에센셜 오일 행을 추가하세요.
                    </span>
                    <span className="cp-soap__print-only">(첨가물 없음)</span>
                  </td>
                </tr>
              )}
              {additiveRows.map((row) => {
                const powderInvalid =
                  row.kind === "powder" && isPowderGramsOutOfRange(row.grams);
                const eoInvalid =
                  row.kind === "eo" && isEoMlOutOfRange(row.ml, totalOilG);
                const rowWarn = powderInvalid || eoInvalid;
                return (
                <tr
                  key={row.id}
                  className={rowWarn ? "cp-soap__tr--additive-warn" : undefined}
                >
                  <td>{row.kind === "powder" ? "분말" : "에센셜 오일"}</td>
                  <td>
                    <span className="cp-soap__print-only cp-soap__print-line">
                      {row.name}
                    </span>
                    {row.kind === "powder" ? (
                      <select
                        className="cp-soap__select cp-soap__screen-only"
                        value={row.presetIndex}
                        onChange={(e) =>
                          updateAdditiveRow(row.id, {
                            presetIndex: Number(e.target.value),
                          })
                        }
                      >
                        {POWDER_PRESETS.map((p, idx) => (
                          <option key={p} value={idx}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="cp-soap__select cp-soap__screen-only"
                        value={row.presetIndex}
                        onChange={(e) =>
                          updateAdditiveRow(row.id, {
                            presetIndex: Number(e.target.value),
                          })
                        }
                      >
                        {EO_PRESETS.map((p, idx) => (
                          <option key={p} value={idx}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <span className="cp-soap__print-only cp-soap__print-line">
                      {row.kind === "powder"
                        ? `${
                            row.grams === ""
                              ? "—"
                              : `${Number(row.grams) || 0} g`
                          }`
                        : `${row.ml} ml`}
                    </span>
                    {row.kind === "powder" ? (
                      <input
                        type="number"
                        className={
                          "cp-soap__input cp-soap__screen-only" +
                          (powderInvalid ? " cp-soap__input--coco-warn" : "")
                        }
                        step={1}
                        value={row.grams === "" ? "" : row.grams}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            updateAdditiveRow(row.id, { grams: "" });
                            return;
                          }
                          updateAdditiveRow(row.id, { grams: Number(v) });
                        }}
                      />
                    ) : (
                      <input
                        type="number"
                        className={
                          "cp-soap__input cp-soap__screen-only" +
                          (eoInvalid ? " cp-soap__input--coco-warn" : "")
                        }
                        step={0.1}
                        value={row.ml}
                        onChange={(e) =>
                          updateAdditiveRow(row.id, {
                            ml: Number(e.target.value),
                          })
                        }
                      />
                    )}
                    <span className="cp-soap__unit cp-soap__screen-only">
                      {row.kind === "powder" ? "g" : "ml"}
                    </span>
                  </td>
                  <td className="cp-soap__screen-only">
                    <button
                      type="button"
                      className="cp-soap__btn cp-soap__btn--ghost"
                      onClick={() => removeAdditiveRow(row.id)}
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
          본 표는 계산 보조용입니다. 가성소다·향료는 안전 수칙을 지키고, 최종 사용 전
          별도 검증을 권장합니다.
        </p>
      </footer>
    </div>
  );
}

export default CpSoapCalculator;
