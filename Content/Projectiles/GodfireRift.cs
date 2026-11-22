using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.Audio;
using Terraria.GameContent;
using Terraria.ID;
using Terraria.ModLoader;

namespace WikiStarter.Content.Projectiles
{
    public class GodfireRift : ModProjectile
    {
        public override string Texture => "WikiStarter/Content/Projectiles/FallenGodRift";

        private static readonly SoundStyle RiftSound = new SoundStyle("WikiStarter/Sounds/FallenGodRift")
        {
            Volume = 0.7f,
            PitchVariance = 0.03f
        };

        private const float EruptionStart = 38f;
        private const float EruptionEnd = 61f;

        public override void SetStaticDefaults()
        {
            Main.projFrames[Type] = 3;
        }

        public override void SetDefaults()
        {
            Projectile.width = 52;
            Projectile.height = 96;
            Projectile.hostile = false;
            Projectile.friendly = false;
            Projectile.penetrate = -1;
            Projectile.timeLeft = 74;
            Projectile.tileCollide = false;
            Projectile.ignoreWater = true;
        }

        public override bool ShouldUpdatePosition() => false;

        public override void AI()
        {
            if (Projectile.ai[0] == 0f && Projectile.ai[1] == 0f && Main.netMode != NetmodeID.Server)
                SoundEngine.PlaySound(RiftSound, Projectile.Center);

            Projectile.ai[0]++;
            Projectile.hostile = Projectile.ai[0] >= EruptionStart && Projectile.ai[0] < EruptionEnd;

            Projectile.frameCounter++;
            if (Projectile.frameCounter >= 5)
            {
                Projectile.frameCounter = 0;
                Projectile.frame = (Projectile.frame + 1) % Main.projFrames[Type];
            }

            Lighting.AddLight(Projectile.Center + new Vector2(0f, 42f), 0.95f, 0.12f, 0.025f);
            if (Projectile.ai[0] < EruptionStart && Main.rand.NextBool(4))
            {
                Vector2 spark = Projectile.Center + new Vector2(Main.rand.NextFloat(-18f, 18f), 36f);
                int dustIndex = Dust.NewDust(spark, 2, 2, DustID.Torch, 0f, -1.5f, 50, new Color(255, 94, 20), 1.1f);
                Main.dust[dustIndex].noGravity = true;
            }
        }

        public override bool? CanDamage() => Projectile.ai[0] >= EruptionStart && Projectile.ai[0] < EruptionEnd;

        public override bool PreDraw(ref Color lightColor)
        {
            Texture2D texture = TextureAssets.Projectile[Type].Value;
            int frameHeight = texture.Height / Main.projFrames[Type];
            Rectangle frame = new Rectangle(0, frameHeight * Projectile.frame, texture.Width, frameHeight);
            Vector2 origin = new Vector2(frame.Width * 0.5f, frame.Height);
            Vector2 drawPosition = Projectile.Center - Main.screenPosition;

            float rise = MathHelper.SmoothStep(0f, 1f, Projectile.ai[0] / 22f);
            float fade = Projectile.ai[0] >= EruptionEnd
                ? MathHelper.Clamp(1f - (Projectile.ai[0] - EruptionEnd) / 13f, 0f, 1f)
                : 1f;
            float scaleY = Projectile.ai[0] < EruptionStart ? MathHelper.Lerp(0.18f, 0.62f, rise) : 1f;
            Color glow = Projectile.ai[0] < EruptionStart
                ? new Color(255, 70, 22) * (0.7f + 0.25f * (float)System.Math.Sin(Main.GameUpdateCount * 0.3f))
                : Color.White;
            glow *= fade;

            Main.EntitySpriteDraw(texture, drawPosition, frame, glow, 0f, origin,
                new Vector2(1.15f, scaleY), SpriteEffects.None, 0f);
            return false;
        }

        public override void OnHitPlayer(Player target, Player.HurtInfo info)
        {
            target.AddBuff(BuffID.OnFire, 180);
        }
    }
}
