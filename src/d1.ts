
// member create
export async function createMember(c, name, email, guid) {
    // TODO insert requires email to be unique
    const now = Date.now()
    try {
        const stmt = c.env.DB.prepare('INSERT INTO members (name, email, role, guid, created, modified) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
            .bind(name, email, 'PENDING', guid, now, now)

        const { success } = await stmt.run()
        return success
    } catch {
        return null
    }
}

// lookup visitor in the Member table
export async function memberByGuid(c, guid) {
    try {
        const stmt = c.env.DB.prepare('SELECT * FROM members WHERE GUID = ?1 AND DELETED IS NULL').bind(guid)
        const { results, success } = await stmt.all()
        if (!success) return null
        if (!results || results.length ==0) return null

        const row = results[0]
        const { name, email, role } = row
        return {name: name, role: role, email: email, refid: guid}
    } catch {
        // TODO better error handling
        return null
    }
}

