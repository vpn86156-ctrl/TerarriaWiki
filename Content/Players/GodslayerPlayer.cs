using Terraria.ModLoader;

namespace WikiStarter.Content.Players
{
    public class GodslayerPlayer : ModPlayer
    {
        public int DivineWaveCooldown;

        public override void PostUpdate()
        {
            if (DivineWaveCooldown > 0)
                DivineWaveCooldown--;
        }
    }
}
