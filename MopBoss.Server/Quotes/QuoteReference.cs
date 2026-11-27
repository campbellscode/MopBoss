using System.Security.Cryptography;

namespace MopBoss.Server.Quotes;

/// <summary>
/// Customer-facing references like MB-7K3Q9X: six characters from an alphabet without
/// look-alikes (no 0/O, 1/I/L), about 887 million combinations. Uniqueness is enforced
/// by a unique index; a collision is retried with a fresh value.
/// </summary>
public static class QuoteReference
{
    public const string Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    public const int Length = 6;

    public static string Create()
    {
        Span<char> chars = stackalloc char[Length];
        for (var i = 0; i < Length; i++)
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return $"MB-{chars}";
    }
}
