import { useState, useMemo, useEffect, useCallback } from "react";
import { SafeArea, SpinLoading, ErrorBlock, Button, Dialog } from "antd-mobile";
import type { ClothingItem, ClothingCategory } from "../shared/types";
import { listClothes, deleteClothes } from "../../api/clothes";
import { ApiError } from "../../api/errors";
import { Icon, PageHeader } from "@moda/ui";
import { useDelayedBusy } from "../shared/useDelayedBusy";
import "./closet.css";

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: "上衣",
  bottom: "下装",
  shoes: "鞋子",
};

const colorLabel: Record<string, string> = {
  white: "白色",
  black: "黑色",
  blue: "蓝色",
  beige: "米色",
  gray: "灰色",
  red: "红色",
  green: "绿色",
  yellow: "黄色",
  pink: "粉色",
  purple: "紫色",
  brown: "棕色",
  orange: "橙色",
  unknown: "未知",
};

const styleLabel: Record<string, string> = {
  casual: "休闲",
  sporty: "运动",
  elegant: "优雅",
  street: "街头",
  business: "商务",
  romantic: "甜美",
  minimalist: "简约",
  vintage: "复古",
  unknown: "未知",
};

// 未知值兜底：翻译不到就原样返回，避免视觉塌陷
function labelOr(
  map: Record<string, string>,
  key: string | null | undefined,
): string {
  if (!key) return "未知";
  return map[key] ?? key;
}

// 多选 style 逗号字符串：取第一个显示，防止太长
function primaryStyle(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const first = raw.split(",")[0]?.trim();
  return first || "unknown";
}

type WardrobeTab = "items" | "outfits" | "selfies" | "lookbook";

/* -------------------------------------------------- */
/*  Empty State Illustration (SVG collage)             */
/* -------------------------------------------------- */

function EmptyCollage() {
  return (
    <div className="closet-collage">
      <svg width="260" height="200" viewBox="0 0 260 200" fill="none">
        {/* Cowboy boot */}
        <g transform="translate(10, 60)">
          <path
            d="M10 0 L50 0 L55 50 L70 70 L70 90 L0 90 L0 70 Z"
            fill="#2a2a2a"
          />
          <path d="M15 5 L45 5 L45 15 L15 15 Z" fill="#444" />
          <path d="M0 70 L70 70 L70 75 L0 75 Z" fill="#555" />
        </g>
        {/* White shirt with red piping */}
        <g transform="translate(85, 5)">
          <path
            d="M30 0 L60 0 L75 20 L75 80 L0 80 L0 20 Z"
            fill="#fafafa"
            stroke="#eee"
            strokeWidth="1"
          />
          <path
            d="M30 0 L45 15 L60 0"
            fill="none"
            stroke="#777"
            strokeWidth="2"
          />
          <path
            d="M0 20 L15 10 L15 40 L0 40 Z"
            fill="#fafafa"
            stroke="#eee"
            strokeWidth="1"
          />
          <path
            d="M75 20 L60 10 L60 40 L75 40 Z"
            fill="#fafafa"
            stroke="#eee"
            strokeWidth="1"
          />
          <circle cx="45" cy="35" r="2" fill="#ddd" />
          <circle cx="45" cy="50" r="2" fill="#ddd" />
          <circle cx="45" cy="65" r="2" fill="#ddd" />
        </g>
        {/* Pink handbag */}
        <g transform="translate(175, 15)">
          <path
            d="M15 25 Q15 0 40 0 Q65 0 65 25"
            fill="none"
            stroke="#666"
            strokeWidth="3"
          />
          <rect x="0" y="25" width="80" height="55" rx="8" fill="#888" />
          <rect x="30" y="45" width="20" height="12" rx="3" fill="#666" />
          <text
            x="40"
            y="54"
            textAnchor="middle"
            fontSize="6"
            fill="#fff"
            fontWeight="600"
          >
            JACQUEMUS
          </text>
        </g>
        {/* Orange V-neck top */}
        <g transform="translate(5, 155)">
          <path d="M25 0 L55 0 L70 15 L70 45 L0 45 L0 15 Z" fill="#555" />
          <path d="M25 0 L40 18 L55 0" fill="#444" />
          <path d="M0 15 L12 8 L12 30 L0 30 Z" fill="#555" />
          <path d="M70 15 L58 8 L58 30 L70 30 Z" fill="#555" />
        </g>
        {/* White Converse sneaker */}
        <g transform="translate(85, 120)">
          <path
            d="M5 40 L10 10 L65 5 L80 15 L80 50 L0 50 Z"
            fill="#fafafa"
            stroke="#eee"
            strokeWidth="1"
          />
          <path d="M0 50 L80 50 L80 60 L0 60 Z" fill="#e0e0e0" />
          <circle
            cx="55"
            cy="30"
            r="8"
            fill="none"
            stroke="#ccc"
            strokeWidth="1.5"
          />
          <path d="M10 10 L10 30" fill="none" stroke="#ccc" strokeWidth="1" />
          <path d="M20 8 L20 28" fill="none" stroke="#ccc" strokeWidth="1" />
          <path d="M30 6 L30 26" fill="none" stroke="#ccc" strokeWidth="1" />
        </g>
        {/* Flared jeans */}
        <g transform="translate(180, 100)">
          <path
            d="M20 0 L60 0 L60 40 L75 95 L45 95 L40 50 L35 95 L5 95 L20 40 Z"
            fill="#aaa"
          />
          <path d="M20 0 L60 0 L60 5 L20 5 Z" fill="#888" />
          <path d="M38 5 L38 35" fill="none" stroke="#888" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
/* ================================================================
   FLOW: My Closet
   ================================================================ */

export function ClosetList() {
  const [, setActiveTab] = useState<WardrobeTab>("items");
  const [searchText, setSearchText] = useState("");
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const showLoading = useDelayedBusy(loading);

  // 避免 lint 未使用告警：本轮 tabs 展示保留但不切换其他数据
  void setActiveTab;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClothes();
      setItems(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "加载失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items;
    const q = searchText.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q),
    );
  }, [items, searchText]);

  /* ================================================
     SCREEN 2: ItemDetail (使用列表返回的字段)
     ================================================ */
  // 轻量自渲染 Toast，绕开 antd-mobile v5 命令式 API 在 React 19 下不生效的问题
  const showFlash = (msg: string) => {
    setFlashMsg(msg);
    window.setTimeout(() => setFlashMsg(null), 1800);
  };

  const openConfirm = () => {
    if (!selectedItem || deleting) return;
    setConfirmVisible(true);
  };

  const doDelete = async () => {
    if (!selectedItem) return;
    const target = selectedItem;
    setConfirmVisible(false);
    setDeleting(true);
    try {
      await deleteClothes(target.id);
      setItems((prev) => prev.filter((i) => i.id !== target.id));
      setSelectedItem(null);
      showFlash("已删除");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "删除失败";
      showFlash(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (selectedItem) {
    const styleKey = primaryStyle(selectedItem.style);
    return (
      <div className="closet-page">
        <PageHeader title="衣物详情" onBack={() => setSelectedItem(null)} />

        <div className="closet-detail-scroll">
          <div className="closet-detail-image-wrap">
            <img
              src={selectedItem.processedImage}
              alt={selectedItem.name}
              className="closet-detail-image"
            />
          </div>

          <div className="closet-detail-body">
            <h2 className="closet-detail-name">{selectedItem.name}</h2>

            <div className="closet-detail-tags">
              <span className="closet-detail-tag closet-detail-tag--primary">
                {categoryLabel[selectedItem.category]}
              </span>
              <span className="closet-detail-tag">
                {labelOr(colorLabel, selectedItem.color)}
              </span>
              <span className="closet-detail-tag">
                {labelOr(styleLabel, styleKey)}
              </span>
            </div>

            <div className="closet-detail-info">
              <div className="closet-info-row">
                <span className="closet-info-label">{"类别"}</span>
                <span className="closet-info-value">
                  {categoryLabel[selectedItem.category]}
                </span>
              </div>
              <div className="closet-info-row">
                <span className="closet-info-label">{"颜色"}</span>
                <span className="closet-info-value">
                  {labelOr(colorLabel, selectedItem.color)}
                </span>
              </div>
              <div className="closet-info-row">
                <span className="closet-info-label">{"风格"}</span>
                <span className="closet-info-value">
                  {labelOr(styleLabel, styleKey)}
                </span>
              </div>
              {selectedItem.subtype && (
                <div className="closet-info-row">
                  <span className="closet-info-label">{"品类"}</span>
                  <span className="closet-info-value">
                    {selectedItem.subtype}
                  </span>
                </div>
              )}
              {selectedItem.season && (
                <div className="closet-info-row">
                  <span className="closet-info-label">{"季节"}</span>
                  <span className="closet-info-value">
                    {selectedItem.season}
                  </span>
                </div>
              )}
              {selectedItem.createdAt && (
                <div className="closet-info-row closet-info-row--last">
                  <span className="closet-info-label">{"添加时间"}</span>
                  <span className="closet-info-value">
                    {new Date(selectedItem.createdAt).toLocaleDateString(
                      "zh-CN",
                    )}
                  </span>
                </div>
              )}
            </div>

            <Button
              block
              color="danger"
              fill="outline"
              loading={deleting}
              disabled={deleting}
              onClick={openConfirm}
              className="closet-detail-delete"
            >
              {"删除这件衣服"}
            </Button>
          </div>
        </div>
        <SafeArea position="bottom" />

        <Dialog
          visible={confirmVisible}
          content={`确定删除「${selectedItem.name}」吗？此操作无法撤销。`}
          closeOnAction
          onClose={() => setConfirmVisible(false)}
          actions={[
            [
              { key: "cancel", text: "取消" },
              {
                key: "confirm",
                text: "删除",
                bold: true,
                danger: true,
                onClick: doDelete,
              },
            ],
          ]}
        />

        {flashMsg && <div className="closet-flash-toast">{flashMsg}</div>}
      </div>
    );
  }

  /* ================================================
     SCREEN 1: ClosetList (main)
     ================================================ */
  return (
    <div className="closet-page">
      {/* Profile Section — fixed header */}
      <div className="closet-profile">
        <div className="closet-profile__left">
          <div className="closet-profile__avatar-wrap">
            <div className="closet-profile__avatar">
              <Icon name="user" size={25} />
            </div>
          </div>
          <div className="closet-profile__info">
            <span className="closet-profile__name">Moda</span>
            <span className="closet-profile__handle">@Moda</span>
          </div>
        </div>
        <div className="closet-profile__spacer" />
      </div>

      {/* Search + Action Buttons — fixed header */}
      <div className="closet-action-row">
        <div className="closet-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder={"搜索"}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="closet-search__input"
          />
        </div>
      </div>

      {/* Content Area — scrollable */}
      <div className="closet-scroll-area">
        {loading ? (
          showLoading ? (
            <div className="closet-state">
              <SpinLoading color="primary" />
              <span className="closet-state__hint">{"加载中…"}</span>
            </div>
          ) : null
        ) : error ? (
          <div className="closet-state">
            <ErrorBlock status="default" title="加载失败" description={error} />
            <Button
              color="primary"
              size="small"
              onClick={() => void fetchItems()}
              className="closet-state__retry"
            >
              {"重试"}
            </Button>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="closet-grid">
            {filteredItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className="closet-grid__card"
                onClick={() => setSelectedItem(item)}
              >
                {item.processedImage ? (
                  <img
                    src={item.processedImage}
                    alt={item.name}
                    className="closet-grid__image"
                  />
                ) : (
                  <div className="closet-grid__placeholder">
                    <Icon name="hanger" size={30} />
                  </div>
                )}
                <div className="closet-grid__footer">
                  <span className="closet-grid__name">{item.name}</span>
                  <span className="closet-grid__tag">
                    {categoryLabel[item.category]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="closet-empty-state">
            <EmptyCollage />
            <span className="closet-empty-state__title">
              {"从上传一件衣物开始"}
            </span>
            <span className="closet-empty-state__description">
              {"底部的“上传衣物”是 Moda 的第一步。"}
            </span>
          </div>
        )}
      </div>

      <SafeArea position="bottom" />
    </div>
  );
}
