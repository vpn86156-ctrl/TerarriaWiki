using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using ReLogic.Content;
using Terraria.ModLoader;

namespace WikiStarter.Content.UI
{
    public class FallenGodBossBar : ModBossBar
    {
        public override Asset<Texture2D> GetIconTexture(ref Rectangle? iconFrame)
        {
            return ModContent.Request<Texture2D>("WikiStarter/Content/NPCs/FallenGod_Head_Boss");
        }
    }
}
