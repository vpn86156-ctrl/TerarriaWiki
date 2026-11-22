using Terraria;
using Terraria.ID;
using Terraria.ModLoader;

namespace WikiStarter.Content.Items
{
    public class FallenGodHeart : ModItem
    {
        public override void SetDefaults()
        {
            Item.width = 32;
            Item.height = 32;
            Item.maxStack = 1;
            Item.value = Item.buyPrice(gold: 2);
            Item.rare = ItemRarityID.Orange;
        }
    }
}
