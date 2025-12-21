export default function FontTest() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Font Test Component</h1>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Switzer Font (Default Sans)</h2>
        <div className="space-y-2">
          <p className="font-thin">
            Thin weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-light">
            Light weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-normal">
            Normal weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-medium">
            Medium weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-semibold">
            Semibold weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-bold">
            Bold weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-extrabold">
            Extrabold weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-black">
            Black weight - The quick brown fox jumps over the lazy dog
          </p>
        </div>

        <h3 className="text-lg font-medium">Force Switzer Test:</h3>
        <div className="space-y-2">
          <p className="font-switzer font-normal">
            Forced Switzer Normal - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-switzer font-bold">
            Forced Switzer Bold - The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Outfit Font (Mono)</h2>
        <div className="space-y-2">
          <p className="font-mono font-thin">
            Thin weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono font-light">
            Light weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono font-normal">
            Normal weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono font-medium">
            Medium weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono font-semibold">
            Semibold weight - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-mono font-bold">
            Bold weight - The quick brown fox jumps over the lazy dog
          </p>
        </div>

        <h3 className="text-lg font-medium">Force Outfit Test:</h3>
        <div className="space-y-2">
          <p className="font-outfit-special font-normal">
            Forced Outfit Normal - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-outfit-special font-bold">
            Forced Outfit Bold - The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">System Fonts (Fallbacks)</h2>
        <div className="space-y-2">
          <p className="font-serif">
            Serif font - The quick brown fox jumps over the lazy dog
          </p>
          <p className="font-sans">
            Sans font - The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </div>
    </div>
  );
}
