using Microsoft.Xna.Framework;
using Terraria;
using Terraria.DataStructures;
using Terraria.ID;
using Terraria.Localization;
using Terraria.ModLoader;
using Terraria.ObjectData;
namespace WikiStarter.Content.Tiles
{
    public class FallenGodStatue : ModTile
    {
        public override void SetStaticDefaults()
        {
            Main.tileFrameImportant[Type] = true;
            Main.tileNoAttach[Type] = true;
            Main.tileLavaDeath[Type] = false;
            TileID.Sets.DisableSmartCursor[Type] = true;

            TileObjectData.newTile.CopyFrom(TileObjectData.Style3x4);
            TileObjectData.newTile.Origin = new Point16(1, 3);
            TileObjectData.newTile.CoordinateHeights = new[] { 16, 16, 16, 16 };
            TileObjectData.newTile.LavaDeath = false;
            TileObjectData.addTile(Type);

            RegisterItemDrop(ModContent.ItemType<WikiStarter.Content.Items.FallenGodStatueItem>());
            AddMapEntry(new Color(220, 159, 45), Language.GetText("Mods.WikiStarter.Tiles.FallenGodStatue.DisplayName"));
            DustType = DustID.Torch;
            HitSound = SoundID.Tink;
        }

        public override void ModifyLight(int i, int j, ref float r, ref float g, ref float b)
        {
            r = 0.36f;
            g = 0.2f;
            b = 0.035f;
        }

        public override void NearbyEffects(int i, int j, bool closer)
        {
            Tile tile = Main.tile[i, j];
            if (tile.TileFrameX == 0 && tile.TileFrameY == 0 && Main.rand.NextBool(90))
            {
                int dustIndex = Dust.NewDust(new Vector2(i * 16 + 18, j * 16 + 12), 12, 28,
                    DustID.Torch, 0f, -0.5f, 110, new Color(255, 192, 70), 0.85f);
                Main.dust[dustIndex].noGravity = true;
            }
        }
    }
}
