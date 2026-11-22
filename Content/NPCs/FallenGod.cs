using Microsoft.Xna.Framework;
using Terraria;
using Terraria.GameContent.ItemDropRules;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Items;
using WikiStarter.Content.Projectiles;

namespace WikiStarter.Content.NPCs
{
    public class FallenGod : ModNPC
    {
        public override void SetStaticDefaults()
        {
            Main.npcFrameCount[Type] = 4;
        }

        public override void SetDefaults()
        {
            NPC.width = 104;
            NPC.height = 160;
            NPC.damage = 45;
            NPC.defense = 15;
            NPC.lifeMax = 7000;
            NPC.value = Item.buyPrice(gold: 8);
            NPC.knockBackResist = 0f;
            NPC.boss = true;
            NPC.noGravity = true;
            NPC.noTileCollide = true;
            NPC.lavaImmune = true;
            NPC.aiStyle = -1;
            NPC.npcSlots = 10f;
            NPC.HitSound = SoundID.NPCHit4;
            NPC.DeathSound = SoundID.NPCDeath14;
            NPC.buffImmune[BuffID.OnFire] = true;
            Music = MusicID.Boss3;
        }

        public override void FindFrame(int frameHeight)
        {
            int frame = 0;
            if (NPC.ai[3] == 1f)
                frame = 1; // crouch and gather power
            else if (NPC.ai[3] == 2f)
                frame = 2; // leap upward
            else if (NPC.ai[3] == 3f)
                frame = 3; // descend into the slam

            NPC.frame.Y = frameHeight * frame;
        }

        public override void AI()
        {
            NPC.TargetClosest();
            Player target = Main.player[NPC.target];

            if (!target.active || target.dead)
            {
                NPC.velocity.Y -= 0.2f;
                if (NPC.timeLeft > 10)
                    NPC.timeLeft = 10;
                return;
            }

            bool enraged = NPC.life < NPC.lifeMax / 2;
            NPC.damage = enraged ? 55 : 45;
            NPC.defense = enraged ? 20 : 15;
            NPC.direction = target.Center.X >= NPC.Center.X ? 1 : -1;
            NPC.spriteDirection = NPC.direction;

            if (NPC.ai[3] == 0f)
            {
                Vector2 hoverPoint = target.Center + new Vector2(-NPC.direction * 230f, -155f);
                Vector2 desiredVelocity = (hoverPoint - NPC.Center).SafeNormalize(Vector2.Zero) * (enraged ? 8f : 6f);
                NPC.velocity = Vector2.Lerp(NPC.velocity, desiredVelocity, 0.045f);

                NPC.ai[0]++;
                int shotInterval = enraged ? 60 : 95;
                if (NPC.ai[0] >= shotInterval)
                {
                    NPC.ai[0] = 0;
                    if (Main.netMode != NetmodeID.MultiplayerClient)
                        FireFan(target, enraged);
                }

                if (enraged)
                {
                    NPC.ai[2]++;
                    if (NPC.ai[2] >= 260)
                    {
                        NPC.ai[2] = 0;
                        NPC.ai[3] = 1f;
                        NPC.velocity *= 0.5f;
                        NPC.netUpdate = true;
                    }
                }
            }
            else
            {
                RunJumpSlam(target);
            }
        }

        private void RunJumpSlam(Player target)
        {
            NPC.ai[2]++;
            float horizontalAim = MathHelper.Clamp((target.Center.X - NPC.Center.X) * 0.025f, -7f, 7f);

            switch ((int)NPC.ai[3])
            {
                case 1: // wind-up
                    NPC.velocity *= 0.72f;
                    if (NPC.ai[2] >= 16)
                    {
                        NPC.ai[2] = 0;
                        NPC.ai[3] = 2f;
                        NPC.velocity = new Vector2(horizontalAim, -13f);
                        NPC.netUpdate = true;
                    }
                    break;

                case 2: // rise
                    NPC.velocity.X = MathHelper.Lerp(NPC.velocity.X, horizontalAim, 0.12f);
                    NPC.velocity.Y = -11f;
                    if (NPC.ai[2] >= 20)
                    {
                        NPC.ai[2] = 0;
                        NPC.ai[3] = 3f;
                        NPC.velocity.Y = 14f;
                        NPC.netUpdate = true;
                    }
                    break;

                case 3: // slam down toward the player
                    NPC.velocity.X = MathHelper.Lerp(NPC.velocity.X, horizontalAim, 0.12f);
                    NPC.velocity.Y = 14f;
                    if (NPC.Center.Y >= target.Center.Y - 45f || NPC.ai[2] >= 32)
                    {
                        NPC.ai[2] = 0;
                        NPC.ai[3] = 4f;
                        NPC.velocity = Vector2.Zero;
                        if (Main.netMode != NetmodeID.MultiplayerClient)
                            FireSlamBurst();
                        NPC.netUpdate = true;
                    }
                    break;

                case 4: // recovery
                    NPC.velocity *= 0.75f;
                    if (NPC.ai[2] >= 18)
                    {
                        NPC.ai[2] = 0;
                        NPC.ai[3] = 0f;
                        NPC.netUpdate = true;
                    }
                    break;
            }
        }

        private void FireFan(Player target, bool enraged)
        {
            Vector2 aim = (target.Center - NPC.Center).SafeNormalize(Vector2.UnitY);
            int projectileCount = enraged ? 5 : 3;
            float spread = enraged ? 0.72f : 0.48f;
            float speed = enraged ? 9f : 8f;
            int damage = enraged ? 32 : 24;

            for (int i = 0; i < projectileCount; i++)
            {
                float progress = projectileCount == 1 ? 0.5f : i / (float)(projectileCount - 1);
                float rotation = MathHelper.Lerp(-spread, spread, progress);
                Vector2 velocity = aim.RotatedBy(rotation) * speed;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), damage, 0f);
            }
        }

        private void FireSlamBurst()
        {
            const int boltCount = 8;
            for (int i = 0; i < boltCount; i++)
            {
                float angle = MathHelper.TwoPi * i / boltCount;
                Vector2 velocity = new Vector2((float)System.Math.Cos(angle), (float)System.Math.Sin(angle)) * 7f;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), 38, 0f);
            }

            // Two low firebolts race outward from the impact like ground shockwaves.
            Vector2 groundPoint = NPC.Bottom - new Vector2(0f, 18f);
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(-10f, 0f),
                ModContent.ProjectileType<GodfireBolt>(), 42, 0f);
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(10f, 0f),
                ModContent.ProjectileType<GodfireBolt>(), 42, 0f);
        }

        public override void ModifyNPCLoot(NPCLoot npcLoot)
        {
            npcLoot.Add(ItemDropRule.Common(ModContent.ItemType<FallenGodHeart>()));
        }
    }
}
