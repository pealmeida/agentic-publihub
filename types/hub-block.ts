export type HubPageLayoutId =
  | "classic"
  | "magazine"
  | "minimal"
  | "hero"
  | "storefront"
  | "stream";

export type HubBlock =
  | {
      id: string;
      type: "product";
      title: string;
      price: number;
      image: string;
      desc: string;
    }
  | { id: string; type: "interactive_donation"; title: string }
  | { id: string; type: "fan_board"; title: string }
  | {
      id: string;
      type: "marketplace_grid";
      title: string;
      channels: string[];
    }
  | {
      id: string;
      type: "ecommerce_embed";
      title: string;
      platform: string;
      syncedCount: number;
    }
  | {
      id: string;
      type: "link_block";
      title: string;
      url: string;
      subtitle: string;
    }
  | {
      id: string;
      type: "coupon_block";
      title: string;
      code: string;
      discountLabel: string;
    }
  | {
      id: string;
      type: "song_block";
      title: string;
      artist: string;
      platform: string;
    };
