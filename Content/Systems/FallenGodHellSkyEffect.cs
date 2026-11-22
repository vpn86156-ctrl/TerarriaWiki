using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.Graphics.Effects;
using Terraria.ModLoader;

namespace WikiStarter.Content.Systems
{
    public class FallenGodHellSkyEffect : CustomSky
    {
        public const string SkyKey = "WikiStarter:FallenGodHell";
        private bool active;
        private float intensity;

        public override void Update(GameTime gameTime)
        {
            float target = active ? 1f : 0f;
            intensity = MathHelper.Lerp(intensity, target, 0.035f);
            if (System.Math.Abs(intensity - target) < 0.002f)
                intensity = target;
        }

        public override Color OnTileColor(Color inColor)
        {
            return Color.Lerp(inColor, new Color(255, 116, 64), intensity * 0.24f);
        }

        public override void Draw(SpriteBatch spriteBatch, float minDepth, float maxDepth)
        {
            if (intensity <= 0.002f || maxDepth < 0f || minDepth >= 0f)
                return;

            Texture2D hellSky = ModContent.Request<Texture2D>("WikiStarter/Content/Systems/FallenGodHellSky").Value;
            Rectangle screen = new Rectangle(0, 0, Main.screenWidth, Main.screenHeight);
            spriteBatch.Draw(hellSky, screen, Color.White * (0.92f * intensity));
        }

        public override float GetCloudAlpha() => 1f - intensity;

        public override void Activate(Vector2 position, params object[] args) => active = true;

        public override void Deactivate(params object[] args) => active = false;

        public override void Reset()
        {
            active = false;
            intensity = 0f;
        }

        public override bool IsActive() => active || intensity > 0.002f;
    }
}
