using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.Audio;
using Terraria.GameContent;
using Terraria.ID;
using Terraria.ModLoader;

namespace WikiStarter.Content.Projectiles
{
    public class GodfireLaser : ModProjectile
    {
        private static readonly SoundStyle ChargeSound = new SoundStyle("WikiStarter/Sounds/FallenGodLaserCharge")
        {
            Volume = 0.65f,
            PitchVariance = 0.02f
        };

        private const float BeamLength = 3200f;
        private const float WarningTime = 46f;
        private const float ActiveEnd = 61f;

        public override string Texture => "WikiStarter/Content/Projectiles/GodfireBolt";

        public override void SetDefaults()
        {
            Projectile.width = 1;
            Projectile.height = 1;
            Projectile.hostile = false;
            Projectile.friendly = false;
            Projectile.penetrate = -1;
            Projectile.timeLeft = 72;
            Projectile.tileCollide = false;
            Projectile.ignoreWater = true;
            Projectile.hide = true;
        }

        public override bool ShouldUpdatePosition() => false;

        public override void AI()
        {
            if (Projectile.ai[0] == 0f && Main.netMode != NetmodeID.Server)
                SoundEngine.PlaySound(ChargeSound, Projectile.Center);

            Projectile.ai[0]++;
            Projectile.rotation = Projectile.velocity.ToRotation();
            Projectile.hostile = Projectile.ai[0] >= WarningTime && Projectile.ai[0] < ActiveEnd;

            if (Projectile.ai[0] < WarningTime && Main.rand.NextBool(5))
            {
                Vector2 direction = Projectile.velocity.SafeNormalize(Vector2.UnitX);
                Vector2 point = Projectile.Center + direction * Main.rand.NextFloat(100f, 900f);
                int dustIndex = Dust.NewDust(point, 2, 2, DustID.Torch, 0f, 0f, 100, new Color(255, 66, 20), 1.1f);
                Main.dust[dustIndex].velocity = direction.RotatedBy(MathHelper.PiOver2) * Main.rand.NextFloat(-1.3f, 1.3f);
                Main.dust[dustIndex].noGravity = true;
            }
        }

        public override bool? CanDamage() => Projectile.ai[0] >= WarningTime && Projectile.ai[0] < ActiveEnd;

        public override bool? Colliding(Rectangle projHitbox, Rectangle targetHitbox)
        {
            if (Projectile.ai[0] < WarningTime || Projectile.ai[0] >= ActiveEnd)
                return false;

            Vector2 start = Projectile.Center;
            Vector2 end = start + Projectile.velocity.SafeNormalize(Vector2.UnitX) * BeamLength;
            float collisionPoint = 0f;
            return Collision.CheckAABBvLineCollision(targetHitbox.TopLeft(), targetHitbox.Size(), start, end, 26f, ref collisionPoint);
        }

        public override bool PreDraw(ref Color lightColor)
        {
            Texture2D pixel = TextureAssets.MagicPixel.Value;
            Vector2 start = Projectile.Center - Main.screenPosition;
            float pulse = 0.75f + 0.25f * (float)System.Math.Sin(Main.GameUpdateCount * 0.28f);
            bool active = Projectile.ai[0] >= WarningTime && Projectile.ai[0] < ActiveEnd;
            float width = active ? 30f : 4f + pulse * 2f;
            Color outer = active ? new Color(255, 64, 14) * 0.78f : new Color(255, 32, 18) * (0.42f + pulse * 0.2f);
            Color inner = active ? new Color(255, 234, 150) * 0.96f : new Color(255, 157, 58) * 0.9f;
            Vector2 scale = new Vector2(BeamLength, width);
            Main.EntitySpriteDraw(pixel, start, new Rectangle(0, 0, 1, 1), outer,
                Projectile.rotation, Vector2.Zero, scale, SpriteEffects.None, 0f);
            scale.Y = active ? 7f : 1.7f;
            Main.EntitySpriteDraw(pixel, start, new Rectangle(0, 0, 1, 1), inner,
                Projectile.rotation, Vector2.Zero, scale, SpriteEffects.None, 0f);
            return false;
        }

        public override void OnHitPlayer(Player target, Player.HurtInfo info)
        {
            target.AddBuff(BuffID.OnFire, 180);
        }
    }
}
