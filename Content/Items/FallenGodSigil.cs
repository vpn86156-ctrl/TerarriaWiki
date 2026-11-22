using Terraria;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.NPCs;

namespace WikiStarter.Content.Items
{
    public class FallenGodSigil : ModItem
    {
        public override void SetDefaults()
        {
            Item.width = 32;
            Item.height = 32;
            Item.maxStack = 20;
            Item.value = Item.buyPrice(silver: 50);
            Item.rare = ItemRarityID.Orange;
            Item.consumable = true;
            Item.useStyle = ItemUseStyleID.HoldUp;
            Item.useTime = 30;
            Item.useAnimation = 30;
            Item.UseSound = SoundID.Roar;
        }

        public override bool CanUseItem(Player player)
        {
            return !NPC.AnyNPCs(ModContent.NPCType<FallenGod>());
        }

        public override bool? UseItem(Player player)
        {
            if (Main.netMode != NetmodeID.MultiplayerClient)
                NPC.SpawnOnPlayer(player.whoAmI, ModContent.NPCType<FallenGod>());

            return true;
        }

        public override void AddRecipes()
        {
            CreateRecipe()
                .AddIngredient(ItemID.HellstoneBar, 12)
                .AddIngredient(ItemID.FallenStar, 5)
                .AddIngredient(ItemID.Fireblossom, 3)
                .AddTile(TileID.DemonAltar)
                .Register();
        }
    }
}
