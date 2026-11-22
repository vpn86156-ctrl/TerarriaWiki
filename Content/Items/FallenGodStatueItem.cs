using Terraria;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Tiles;

namespace WikiStarter.Content.Items
{
    public class FallenGodStatueItem : ModItem
    {
        public override string Texture => "WikiStarter/Content/Tiles/FallenGodStatue";

        public override void SetDefaults()
        {
            Item.DefaultToPlaceableTile(ModContent.TileType<FallenGodStatue>());
            Item.width = 32;
            Item.height = 48;
            Item.maxStack = 99;
            Item.value = Item.buyPrice(gold: 2);
            Item.rare = ItemRarityID.Orange;
        }
    }
}
